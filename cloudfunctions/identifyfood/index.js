const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ 
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 百度AI配置 - 请在百度AI开放平台申请
const BAIDU_API_KEY = 'xlggSMlRgc5RJG1XFo6htQKX'  // 替换为你的API Key
const BAIDU_SECRET_KEY = 'CX08MGURWPAfmO5sLfTQ7ccVCtrjnS2j'  // 替换为你的Secret Key

// 获取百度access_token（缓存机制）
let cachedToken = null
let tokenExpireTime = 0

async function getBaiduAccessToken() {
  // 如果token还未过期，直接返回
  if (cachedToken && Date.now() < tokenExpireTime) {
    return cachedToken
  }

  try {
    const response = await axios.get('https://aip.baidubce.com/oauth/2.0/token', {
      params: {
        grant_type: 'client_credentials',
        client_id: BAIDU_API_KEY,
        client_secret: BAIDU_SECRET_KEY
      }
    })

    cachedToken = response.data.access_token
    // token有效期30天，提前1天过期
    tokenExpireTime = Date.now() + (29 * 24 * 60 * 60 * 1000)
    
    return cachedToken
  } catch (err) {
    console.error('获取百度access_token失败:', err)
    throw new Error('获取百度token失败')
  }
}

// 调用百度菜品识别API
async function recognizeDish(imageBase64) {
  const accessToken = await getBaiduAccessToken()
  
  try {
    const response = await axios.post(
      `https://aip.baidubce.com/rest/2.0/image-classify/v2/dish?access_token=${accessToken}`,
      `image=${encodeURIComponent(imageBase64)}&top_num=5`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    console.log('百度API返回:', JSON.stringify(response.data))
    return response.data
  } catch (err) {
    console.error('百度菜品识别失败:', err.response?.data || err.message)
    throw err
  }
}

exports.main = async (event, context) => {
  const { fileID } = event
  console.log('开始处理图片识别，fileID:', fileID)
  
  try {
    // 1. 下载图片
    console.log('开始下载文件...')
    const downloadRes = await cloud.downloadFile({ fileID })
    const imageBuffer = downloadRes.fileContent
    console.log(`文件下载完成，大小: ${imageBuffer.length} bytes`)

    // 2. 转换为base64
    const imageBase64 = imageBuffer.toString('base64')
    console.log('图片已转换为base64')

    // 3. 调用百度菜品识别API
    console.log('调用百度菜品识别API...')
    const baiduResult = await recognizeDish(imageBase64)

    // 4. 转换百度返回格式为微信格式（保持前端兼容）
    if (baiduResult.result && baiduResult.result.length > 0) {
      const dishList = baiduResult.result.map(item => ({
        name: item.name,
        calorie: item.calorie || 130,  // 百度API返回卡路里
        probability: item.probability   // 置信度
      }))

      console.log('识别成功，菜品数量:', dishList.length)
      
      return {
        dish_num_list: dishList,
        result_num: dishList.length
      }
    } else {
      console.log('未识别到菜品')
      return {
        dish_num_list: [],
        result_num: 0
      }
    }
  } catch (err) {
    console.error('云函数执行错误:', err)
    
    // 返回友好的错误信息
    return { 
      dish_num_list: [],
      error: err.message || '未知错误', 
      errMsg: `识别失败: ${err.message || 'unknown'}`,
      errCode: err.code || -1
    }
  }
}