// app.js
App({
  onLaunch: function() {
    wx.cloud.init({
      env: 'cloud1-0gtnqy3z1c048750', 
      traceUser: true,
    });
  }
});