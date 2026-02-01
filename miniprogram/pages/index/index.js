// 1. 初始化数据库
const db = wx.cloud.database({
    env: 'cloud1-0gtnqy3z1c048750'
});

Page({
  data: {
    weight: 0, lastWeight: 0, targetWeight: 0, diffWeight: 0,
    totalBudget: 1500, breakfastCal: 0, remCal: 1500, progressWidth: '0%',
    shapes: ['圆碗', '方碗', '圆盘', '方盘', '圆深盘', '方深盘'],
    shapeFactors: [1.0, 1.1, 0.4, 0.45, 0.7, 0.75],
    fillLevels: ['1/3满', '1/2满', '平口', '冒尖'],
    fillFactors: [0.33, 0.5, 1.0, 1.3],
    tempBaseVol: 450, 
    tempFoodName: '',
    tempCalPer100g: 0
  },

  onShow: function() { this.readAllDataFromCloud(); },

  readAllDataFromCloud() {
    db.collection('daily_records').where({ type: 'user_settings' }).orderBy('date', 'desc').limit(1).get({
      success: res => {
        if (res.data.length > 0) {
          const s = res.data[0];
          this.setData({ targetWeight: s.targetWeight, totalBudget: s.target });
          this.calculateCalories();
          this.calculateDiff();
        }
      }
    });
    db.collection('daily_records').where({ type: 'weight_check' }).orderBy('date', 'desc').limit(1).get({
      success: res => { if (res.data.length > 0) { this.setData({ lastWeight: res.data[0].weight }); this.calculateDiff(); } }
    });
  },

  onCameraTap() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'],
      success: (res) => { this.uploadAndIdentify(res.tempFiles[0].tempFilePath); }
    })
  },

  uploadAndIdentify(path) {
    wx.showLoading({ title: '百度 AI 识别中...' });
    const cloudPath = `food/${Date.now()}.jpg`;
    
    wx.cloud.uploadFile({
      cloudPath,
      filePath: path,
      success: res => {
        wx.cloud.callFunction({
          name: 'identifyfood',
          data: { fileID: res.fileID },
          timeout: 20000,
          success: resCloud => {
            wx.hideLoading();
            console.log('云函数返回结果：', resCloud);
            
            if (resCloud.result && resCloud.result.error) {
              console.error('云函数内部错误：', resCloud.result);
              this.handleManualEntry(`识别失败：${resCloud.result.errMsg || resCloud.result.error}`);
              return;
            }
            
            const list = resCloud.result.dish_num_list || [];
            console.log('识别到的菜品列表:', list);
            
            if (list.length > 0) {
              const topItem = list[0];
              
              if (topItem.name === '请手动输入') {
                this.handleManualEntry("AI 服务暂不可用，请手动输入菜名");
                return;
              }
              
              // 如果有多个结果，让用户选择
              if (list.length > 1) {
                this.showDishSelection(list);
              } else {
                // 只有一个结果，直接使用
                this.setData({
                  tempFoodName: topItem.name,
                  tempCalPer100g: topItem.calorie || 120 
                });
                this.startDimensionSelect();
              }
            } else {
              this.handleManualEntry("AI 没认出来，请手动输入菜名");
            }
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('云函数调用失败：', err);
            this.handleManualEntry(`云函数连接失败(${err.errMsg || 'unknown'})，请手动输入`);
          }
        })
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('图片上传失败：', err);
        wx.showToast({ 
          title: `上传失败：${err.errMsg || 'unknown'}`, 
          icon: 'none',
          duration: 2000
        });
      }
    })
  },

  // 显示多个识别结果供用户选择
  showDishSelection(dishList) {
    const itemList = dishList.map(item => 
      `${item.name} (${item.probability}% 匹配, ${item.calorie}卡/100g)`
    );
    itemList.push('都不对，手动输入');

    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        const tapIndex = res.tapIndex;
        if (tapIndex < dishList.length) {
          // 用户选择了某个菜品
          const selectedDish = dishList[tapIndex];
          this.setData({
            tempFoodName: selectedDish.name,
            tempCalPer100g: selectedDish.calorie || 120
          });
          this.startDimensionSelect();
        } else {
          // 用户选择了"手动输入"
          this.handleManualEntry("请输入正确的菜名");
        }
      },
      fail: () => {
        // 用户取消，进入手动输入
        this.handleManualEntry("请输入菜名");
      }
    });
  },

  handleManualEntry(msg) {
    wx.showModal({
      title: '识别提醒',
      content: msg,
      editable: true,
      placeholderText: '例如：红烧肉',
      success: (res) => {
        if (res.confirm && res.content) {
          this.setData({ tempFoodName: res.content, tempCalPer100g: 130 });
          this.startDimensionSelect();
        }
      }
    })
  },

  startDimensionSelect() {
    wx.showActionSheet({
      itemList: this.data.shapes,
      title: `微信 AI：${this.data.tempFoodName}`,
      success: (res1) => {
        wx.showActionSheet({
          itemList: this.data.fillLevels,
          title: '请确认分量',
          success: (res2) => {
            this.calculateFinalResult(res1.tapIndex, res2.tapIndex);
          }
        });
      }
    });
  },

  calculateFinalResult(sIdx, fIdx) {
    const finalWeight = Math.round(this.data.tempBaseVol * this.data.shapeFactors[sIdx] * this.data.fillFactors[fIdx] * 0.85);
    const finalCal = Math.round((this.data.tempCalPer100g / 100) * finalWeight);

    wx.showModal({
      title: '微信 AI 精算报告',
      content: `食物：${this.data.tempFoodName}\n估算克重：${finalWeight}g\n估算热量：${finalCal} kcal`,
      confirmText: '计入今日',
      success: (res) => {
        if (res.confirm) {
          this.setData({ breakfastCal: this.data.breakfastCal + finalCal });
          this.calculateCalories();
        }
      }
    });
  },

  calculateCalories() {
    let remaining = this.data.totalBudget - this.data.breakfastCal;
    let percent = (this.data.breakfastCal / this.data.totalBudget * 100).toFixed(2);
    this.setData({ remCal: remaining, progressWidth: (percent > 100 ? 100 : percent) + '%' });
  },

  calculateDiff() {
    const { lastWeight, targetWeight } = this.data;
    if (lastWeight > 0 && targetWeight > 0) {
      this.setData({ diffWeight: (lastWeight - targetWeight).toFixed(1) });
    }
  },

  saveWeight() {
    if (!this.data.weight) return;
    db.collection('daily_records').add({
      data: { weight: parseFloat(this.data.weight), date: new Date(), type: 'weight_check' },
      success: () => {
        wx.showToast({ title: '同步成功' });
        this.setData({ lastWeight: this.data.weight });
        this.calculateDiff();
      }
    })
  },

  getWeight(e) { this.setData({ weight: e.detail.value }); },
  goToSettings() { wx.navigateTo({ url: '/pages/settings/settings' }); }
})