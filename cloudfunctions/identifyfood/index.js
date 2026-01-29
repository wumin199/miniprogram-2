const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { fileID } = event
  try {
    // 1. 获取图片的二进制数据
    const res = await cloud.downloadFile({ fileID })
    const imageBuffer = res.fileContent

    // 2. 直接调用微信原生菜品识别接口
    const result = await cloud.openapi.img.dish({
      contentType: 'image/jpeg',
      value: imageBuffer
    })

    // 微信接口返回的数组在 result.dish_num_list 中
    return result
  } catch (err) {
    return { error: err.message, errMsg: "微信识别接口异常" }
  }
}