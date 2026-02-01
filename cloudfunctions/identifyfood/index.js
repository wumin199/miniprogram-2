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
    const errMsg = err?.message || err?.errMsg || '未知错误'
    throw new Error(`获取百度token失败: ${errMsg}`)
  }
}

// 调用百度菜品识别API
async function recognizeDish(imageBase64) {
  const accessToken = await getBaiduAccessToken()
  
  try {
    // 构建请求参数
    const params = new URLSearchParams({
      image: imageBase64,
      top_num: '5',           // 返回前5个结果
      filter_threshold: '0.05' // 降低置信度阈值到5%，获取更多候选
    })
    
    console.log('请求参数:', { top_num: 5, filter_threshold: 0.05 })
    
    const response = await axios.post(
      `https://aip.baidubce.com/rest/2.0/image-classify/v2/dish?access_token=${accessToken}`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
      }
    )

    console.log('百度API返回:', JSON.stringify(response.data))
    return response.data
  } catch (err) {
    console.error('百度菜品识别失败:', err.response?.data || err?.message || err)
    const errMsg = err?.response?.data?.error_msg || err?.message || '识别接口异常'
    const newErr = new Error(errMsg)
    newErr.code = err?.response?.status || err?.code || -1
    throw newErr
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

    // 4. 转换百度返回格式并优化结果
    if (baiduResult.result && baiduResult.result.length > 0) {
      // 过滤低置信度结果（降低门槛到0.3，显示更多结果）
      const filteredResults = baiduResult.result.filter(item => 
        item.probability > 0.3
      )
      
      const dishList = filteredResults.map(item => ({
        name: item.name,
        calorie: Math.round(item.calorie || 130),  // 四舍五入卡路里
        probability: Math.round(item.probability * 100)  // 转换为百分比
      }))

      console.log('识别成功，过滤后菜品数量:', dishList.length)
      console.log('原始结果数量:', baiduResult.result.length)
      console.log('菜品列表:', JSON.stringify(dishList))
      
      return {
        dish_num_list: dishList,
        result_num: dishList.length,
        original_count: baiduResult.result.length  // 原始识别数量
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
    
    // 安全地提取错误信息
    const errorMessage = err?.message || err?.errMsg || err?.error || '未知错误'
    const errorCode = err?.code || err?.errCode || -1
    
    // 返回友好的错误信息
    return { 
      dish_num_list: [],
      error: errorMessage, 
      errMsg: `识别失败: ${errorMessage}`,
      errCode: errorCode
    }
  }
}