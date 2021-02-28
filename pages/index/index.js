// index.js
// 获取应用实例
const app = getApp()

Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    devices:[]
  },
  // 事件处理函数
  bindViewTap() {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onLoad() {
    this.openBluetoothAdapter();
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse) {
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      app.userInfoReadyCallback = res => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    }
  },
  getUserInfo(e) {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },
  /**
   小程序与蓝牙设备通讯，总结一下分为下面几点：
      1.小程序初始化蓝牙模块
      2.搜索设备
      3.连接设备 获取蓝牙的所有服务以及服务对应的特征值，根据特征值进行读写和监听设备的数据返回
      4. 写入数据
      5. 读取蓝牙设备返回数据
   **/
  //初始化蓝牙
  openBluetoothAdapter() {
    var that = this;
    //初始化蓝牙模块
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('openBluetoothAdapter success', res)
        that.startBluetoothDevicesDiscovery()
      },
      fail: (res) => {
        console.log(res);
        if (res.errCode === 10001) {
          wx.onBluetoothAdapterStateChange(function (res) {
            console.log('onBluetoothAdapterStateChange', res)
            if (res.available) {
              that.startBluetoothDevicesDiscovery()
            }
          })
        }
      }
    })
  },
  //开始搜寻附近的蓝牙外围设备
  startBluetoothDevicesDiscovery() {
    var that = this;
    if (that._discoveryStarted) {
      return
    }
    that._discoveryStarted = true
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success: (res) => {
        console.log('startBluetoothDevicesDiscovery success', res)
        that.onBluetoothDeviceFound()
      },
    })
  },
  //停止搜寻附近的蓝牙外围设备
  stopBluetoothDevicesDiscovery() {
    wx.stopBluetoothDevicesDiscovery()
  },
  //监听寻找到新设备的事件
  onBluetoothDeviceFound() {
    var that = this;
    wx.onBluetoothDeviceFound((res) => {
      // console.log("==============================")
      // console.log(res)
      // console.log("==============================")
      res.devices.forEach(device => {
        console.log(device);
        if (!device.name && !device.localName) {
          // console.log("参数为空：{},{},{}",device.RSSI,device.advertisData,device.deviceId)
          return
        }
        const foundDevices = that.data.devices
        console.log(foundDevices);
        const idx = inArray(foundDevices, 'deviceId', device.deviceId)
        const data = {}
        if (idx === -1) {
          data[`devices[${foundDevices.length}]`] = device
        } else {
          data[`devices[${idx}]`] = device
        }
        that.setData(data)
        console.log(data)
      })
    })
  },
  //连接低功耗蓝牙设备
  createBLEConnection(e) {
    var that = this;
    const ds = e.currentTarget.dataset
    const deviceId = ds.deviceId
    const name = ds.name
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        that.setData({
          connected: true,
          name,
          deviceId,
        })
        that.getBLEDeviceServices(deviceId)
      }
    })
    that.stopBluetoothDevicesDiscovery()
  },
  //获取蓝牙设备所有服务(service)。
  getBLEDeviceServices(deviceId) {
    var that = this;
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        //获取设备服务中isPrimary为true的服务
        for (let i = 0; i < res.services.length; i++) {
          if (res.services[i].isPrimary) {
            //获取这个服务的特征值
            that.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid)
            return
          }
        }
      },
      fail(res) {
        console.error('22', res)
      }
    })
  },
  //获取蓝牙设备某个服务中所有特征值(characteristic)。
  getBLEDeviceCharacteristics(deviceId, serviceId) {
    var that = this;
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        for (let i = 0; i < res.characteristics.length; i++) {
          let item = res.characteristics[i]
          if (item.properties.read) {
            wx.readBLECharacteristicValue({  //读取低功耗蓝牙设备的特征值的二进制数据值
              deviceId,
              serviceId,
              characteristicId: item.uuid,
            })
          }
          if (item.properties.write) {  //写入低功耗蓝牙设备的特征值的二进制数据值
            that.setData({
              canWrite: true,
              writeDeviceId: deviceId,
              writeServiceId: serviceId,
              writeCharacteristicId: item.uuid
            })
          }
          if (item.properties.notify || item.properties.indicate) {
            wx.notifyBLECharacteristicValueChange({   //启用低功耗蓝牙设备特征值变化时的 notify 功能
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              state: true,
              success(res) {
                console.log('notifyBLECharacteristicValueChange success', res);
                // 操作之前先监听，保证第一时间获取数据
                wx.onBLECharacteristicValueChange((characteristic) => {
                  //处理蓝牙返回的数据
                  that.parseReturnData(characteristic.value);
                })
              }
            })
          }
        }
      },
      fail(res) {
        console.error('getBLEDeviceCharacteristics', res)
      }
    })
  },
  //分包写入蓝牙
  writeBLECharacteristicValue(buffer) {
    let pos = 0;
    let bytes = buffer.byteLength;
    var that = this;
    let ArrayBuffer = buffer.buffer;
    console.log("bytes", bytes)
    while (bytes > 0) {
      let tmpBuffer;
      if (bytes > 20) {
        tmpBuffer = ArrayBuffer.slice(pos, pos + 20);
        pos += 20;
        bytes -= 20;
        wx.writeBLECharacteristicValue({
          deviceId: that.data.writeDeviceId,
          serviceId: that.data.writeServiceId,
          characteristicId: that.data.writeCharacteristicId,
          value: tmpBuffer,
          success(res) {
            console.log('第一次发送', res)
          },
          fail: function (res) {
            if (res.errCode == '10006') {
              that.clearConnectData(); //当前连接已断开，清空连接数据
            }
            console.log('发送失败', res)
          }
        })
        // })
        sleep(0.02)
      } else {
        tmpBuffer = ArrayBuffer.slice(pos, pos + bytes);
        pos += bytes;
        bytes -= bytes;
        wx.writeBLECharacteristicValue({
          deviceId: that.data.writeDeviceId,
          serviceId: that.data.writeServiceId,
          characteristicId: that.data.writeCharacteristicId,
          value: tmpBuffer,
          success(res) {
            console.log('第二次发送', res)
          },
          fail: function (res) {
            if (res.errCode == '10006') {
              that.clearConnectData(); //清空连接数据
              console.log('当前连接已断开');
            }
            console.log('发送失败', res)
          }
        })
        sleep(0.02)
      }
    }
  },
  //拼接硬件返回的分包数据
  parseReturnData(buf) {
    var that = this;
    var buf = new Int8Array(buf);
    //校验是不是首条包
    var isFirstPackage = checkCode(buf);
    var singleBag = Array.from(buf);
    if (isFirstPackage) {  //
      that.data.cmd = singleBag[0];
      that.data.statusCode = singleBag[1];
      that.data.datalength = singleBag[2];
      if (that.data.datalength == 0) { //数据长度为0，说明没有数据
        that.data.checkSums = singleBag[singleBag.length - 1];
      }
      if (that.data.datalength > 0 && that.data.datalength <= 16) { //数据长度大于0，说明没有数据
        that.data.checkSums = singleBag[singleBag.length - 1];
        that.data.packData = singleBag.splice(3, singleBag.length - 4);
        that.data.datalength = 0;
      }
      if (that.data.datalength > 17) { //数据长度大于17，说明数据分包了
        that.data.packData = singleBag.splice(3, singleBag.length - 3);
        that.data.datalength -= 17; //数据长度减17
      }
    } else {
      if (that.data.datalength > 0) {
        if (that.data.datalength <= 19) {
          if (that.data.datalength == singleBag.length - 1) { //判断数据剩余长度与当前包的数据长度是否一致
            that.data.checkSums = singleBag[singleBag.length - 1];
            that.data.packData = that.data.packData.concat(singleBag.splice(0, singleBag.length - 1));
            that.data.datalength = 0;
          } else {
            that.data.datalength = that.data.datalength - singleBag.length;
            that.data.packData = that.data.packData.concat(singleBag.splice(0, singleBag.length));
          }
        } else {
          that.data.datalength -= singleBag.length; //数据长度减17
          that.data.packData = that.data.packData.concat(singleBag);
        }
      }
    }
    if (that.data.datalength == 0) {
      var data = ab2str(that.data.packData);
      console.log('返回值解析后:' + data);
      //把收到的数据解析出来展示在页面，方便测试
      that.showLog(that.data.cmd, that.data.statusCode, that.data.packData, that.data.checkSums);
      that.setData({
        packData: [], // 分包数据
        cmd: null, // 命令码
        statusCode: null, // 状态码
        datalength: null, // 数据长度
        checkSums: null, // 校验和
      })
    }
  }
})
