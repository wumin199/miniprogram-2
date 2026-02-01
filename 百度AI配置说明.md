# 百度AI菜品识别配置指南

## 1. 申请百度AI服务

### 步骤1：注册百度账号
访问 [百度AI开放平台](https://ai.baidu.com/)，注册并登录

### 步骤2：创建应用
1. 进入控制台：https://console.bce.baidu.com/ai/
2. 选择 **图像识别** > **菜品识别**
3. 点击 **创建应用**
4. 填写应用信息：
   - 应用名称：我的减重助手
   - 应用描述：用于识别菜品计算卡路里
   - 接口选择：勾选 **菜品识别**

### 步骤3：获取API密钥
创建成功后，会显示：
- **API Key**：类似 `xxxxxxxxxxxxxxxxxxx`
- **Secret Key**：类似 `yyyyyyyyyyyyyyyyyyy`

**保存这两个密钥！**

## 2. 配置云函数

### 方式1：直接修改代码（快速测试）

打开 [cloudfunctions/identifyfood/index.js](cloudfunctions/identifyfood/index.js#L8-L9)，替换密钥：

```javascript
const BAIDU_API_KEY = '你的API_Key'  // 替换这里
const BAIDU_SECRET_KEY = '你的Secret_Key'  // 替换这里
```

### 方式2：使用环境变量（推荐生产环境）

1. 打开云开发控制台
2. 进入"云函数" > `identifyfood` > "配置"
3. 添加环境变量：
   - `BAIDU_API_KEY`: 你的API Key
   - `BAIDU_SECRET_KEY`: 你的Secret Key

然后修改代码：
```javascript
const BAIDU_API_KEY = process.env.BAIDU_API_KEY || 'your_api_key_here'
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || 'your_secret_key_here'
```

## 3. 部署云函数

1. 右键 `cloudfunctions/identifyfood` 文件夹
2. 选择 **"上传并部署：云端安装依赖"**
3. 等待部署完成（会自动安装 axios 依赖）

## 4. 测试

1. 在小程序中点击拍照按钮
2. 选择一张菜品图片
3. 查看是否能正确识别菜品名称

## 5. 费用说明

百度菜品识别API免费额度：
- **免费调用量**：每天 500 次
- **并发限制**：2 QPS（每秒2次请求）
- 超出免费额度后：￥0.002/次

对于个人使用，免费额度完全足够。

## 6. API返回格式

百度API返回示例：
```json
{
  "result_num": 3,
  "result": [
    {
      "name": "红烧肉",
      "calorie": 285.5,
      "probability": 0.952
    },
    {
      "name": "东坡肉",
      "calorie": 310.2,
      "probability": 0.823
    }
  ]
}
```

云函数已自动转换为小程序需要的格式。

## 7. 故障排查

### 错误1：获取token失败
- 检查API Key和Secret Key是否正确
- 检查网络连接
- 查看云函数日志中的详细错误

### 错误2：识别失败
- 检查图片是否清晰
- 图片大小不超过4MB
- 图片格式支持：JPG、PNG、BMP

### 错误3：超出配额
- 查看百度控制台的调用量统计
- 考虑升级套餐或优化调用频率

## 8. 优化建议

1. **缓存机制**：代码已实现access_token缓存，减少API调用
2. **错误重试**：可添加失败重试机制
3. **本地缓存**：对于常见菜品，可建立本地数据库
4. **用户反馈**：允许用户修正AI识别结果

## 参考资料

- [百度AI开放平台](https://ai.baidu.com/)
- [菜品识别API文档](https://ai.baidu.com/ai-doc/IMAGERECOGNITION/Xk3bcx60t)
- [API调用示例](https://ai.baidu.com/ai-doc/IMAGERECOGNITION/Xk3bcx60t#%E8%AF%B7%E6%B1%82%E7%A4%BA%E4%BE%8B)
