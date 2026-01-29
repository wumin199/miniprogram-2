const db = wx.cloud.database({
  env: 'cloud1-0gtnqy3z1c048750'
});

Page({
  data: {
    genders: ['男', '女'],
    genderIndex: 0,
    age: '',
    height: '',
    currentWeight: '',
    targetWeight: '',
    exercise: 0,
    bmr: 0,
    finalBudget: 0
  },

  onLoad: function() {
    this.loadCurrentSettings();
  },

  loadCurrentSettings() {
    db.collection('daily_records').where({ type: 'user_settings' }).orderBy('date', 'desc').limit(1).get({
      success: res => {
        if (res.data.length > 0) {
          const s = res.data[0];
          this.setData({
            genderIndex: s.genderIndex || 0,
            age: s.age || '',
            height: s.height || '',
            currentWeight: s.currentWeight || '',
            targetWeight: s.targetWeight || '',
            exercise: s.exercise || 0
          }, () => {
            this.calculateAll();
          });
        }
      }
    })
  },

  // 监听所有输入
  bindGenderChange(e) { this.setData({ genderIndex: e.detail.value }); this.calculateAll(); },
  inputAge(e) { this.setData({ age: e.detail.value }); this.calculateAll(); },
  inputHeight(e) { this.setData({ height: e.detail.value }); this.calculateAll(); },
  inputCurrentWeight(e) { this.setData({ currentWeight: e.detail.value }); this.calculateAll(); },
  inputTargetWeight(e) { this.setData({ targetWeight: e.detail.value }); },
  inputExercise(e) { this.setData({ exercise: e.detail.value || 0 }); this.calculateAll(); },

  // 核心自动调整逻辑
  calculateAll() {
    const { age, height, currentWeight, genderIndex, exercise } = this.data;
    if (age && height && currentWeight) {
      // 1. 计算 BMR
      let bmrVal = (10 * parseFloat(currentWeight)) + (6.25 * parseFloat(height)) - (5 * parseInt(age));
      bmrVal = (genderIndex == 0) ? bmrVal + 5 : bmrVal - 161;
      
      // 2. 计算 最终预算 = BMR + 运动 - 500缺口
      let budgetVal = Math.round(bmrVal) + parseInt(exercise) - 500;
      
      this.setData({
        bmr: Math.round(bmrVal),
        finalBudget: budgetVal > 1000 ? budgetVal : 1000 // 确保每日摄入不低于1000卡安全线
      });
    }
  },

  saveSettings() {
    const s = this.data;
    if (!s.targetWeight || !s.bmr) {
      wx.showToast({ title: '数据不完整', icon: 'none' });
      return;
    }

    db.collection('daily_records').add({
      data: {
        type: 'user_settings',
        date: new Date(),
        genderIndex: s.genderIndex,
        age: s.age,
        height: s.height,
        currentWeight: s.currentWeight,
        targetWeight: s.targetWeight,
        exercise: s.exercise,
        bmr: s.bmr,
        target: s.finalBudget // 将自动调整后的预算存入 target 供主页使用
      },
      success: () => {
        wx.showToast({ title: '档案已更新' });
        setTimeout(() => { wx.navigateBack(); }, 1000);
      }
    })
  }
})