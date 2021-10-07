{
  var client;
  // Our wrapper for actual devices
  var tajDevices = {};
  var scanId;
  var executingId;

  buttplugInitialize = async function () {

    try {
      await Buttplug.buttplugInit();
    } catch (e) {
      console.log("Failed to init: " + e);
    }

    if (client) {
      await client.stopAllDevices();
      await client.disconnect();
    }

    const connector = new Buttplug.ButtplugEmbeddedConnectorOptions();
    client = new Buttplug.ButtplugClient("TAJ Client");
    await client.connect(connector);

    client.addListener("deviceadded", (device) => {
      console.log(`Device Connected: ${device.Name}`);
      tajDevices[device.Name] = { device: device, 
         AllowedMessages: tajDeviceAllowedMessages, stop: tajDeviceStop,
         execute: tajDeviceExecute, executeIp: tajDeviceExecuteIp, send: tajDeviceSend };
      //console.log("Client currently knows about these devices:");
      //client.Devices.forEach((device) => console.log(`- ${device.Name}`));
      if (scanId) {
        tajDevices[device.Name].send(scanId);
      } 
    });
    client
      .addListener("deviceremoved", (device) => {
        console.log(`Device Removed: ${device.Name}`)
        tajDevices[device.Name] = null;
      });
  }

  buttplugStartScanning = function (id) {
    scanId = id;
    client.startScanning();
  };

  function getDeviceByName(name) {
    return tajDevices[name];
  }

  function sleeper(ms) {
    return function(x) {
      return new Promise(resolve => setTimeout(() => resolve(x), ms));
    };
  }

  function tajDeviceSend(id, info) {
    var allowed = this.AllowedMessages();
    var msg = { name: id, bluetooth: { device: this.device.Name, allowedMessages: allowed, info: info }};
    tajSend(msg);
  }

  function tajDeviceStop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.device.stop(); 
  }

  function tajDeviceExecute(instructions) {
    this.instructions = instructions;
    this.ip = 0;
    this.lastDelayEnd = Date.now();

    this.executeIp();
  }

  function tajDeviceAllowedMessages() {
    const messageTypeMap = {
      [Buttplug.ButtplugDeviceMessageType.VibrateCmd]: "vibrate",
      [Buttplug.ButtplugDeviceMessageType.RotateCmd]: "rotate",
      [Buttplug.ButtplugDeviceMessageType.LinearCmd]: "linear",
      [Buttplug.ButtplugDeviceMessageType.StopDeviceCmd]: "stop",
      [Buttplug.ButtplugDeviceMessageType.BatteryLevelCmd]: "batteryLevel",
      [Buttplug.ButtplugDeviceMessageType.RSSILevelCmd]: "rssiLevel",
    };

    var result = {};
    var allowed = this.device.AllowedMessages;

    for (var i = 0; i < allowed.length; i++) {
      var mt = allowed[i];
      var mapped = messageTypeMap[mt];
      if (mapped) {
        result[mapped] = this.device.messageAttributes(mt);
      }
    }

    return result;
  }

  function errorHandler(thisVal, cmd) {
    return function(err) {
      thisVal.send(executingId, {error: err, command: cmd });
    };
  }

  function tajDeviceExecuteIp() {
    while (true) {
      if (this.ip >= this.instructions.length) {
        return;
      }
      var ins = this.instructions[this.ip++];
      
      var cmd = ins;
      if (typeof ins != "string") {
	cmd = ins[0];
      }

      if (cmd == 'stop') {
	this.stop();
	return;
      }

      if (cmd == 'delay') {
        let delay = ins[1];
        if (this.lastDelayEnd) {
          delay -= Date.now() - this.lastDelayEnd;
          if (delay <= 0) {
            delay = 1;
          }
        }
	this.lastDelayEnd = Date.now() + delay;
        
        this.timer = setTimeout(() => { this.executeIp() }, delay);
        return;
      }

      if (cmd == "vibrate") {
        this.device.vibrate(ins[1]).then(r => { this.executeIp(); }).catch(errorHandler(this, cmd));
        return;
      }

      if (cmd == "rotate") {
        this.device.rotate(ins[1], ins[2]).then(r => { this.executeIp(); }).catch(errorHandler(this, cmd));
        return;
      }

      if (cmd == "linear") {
        this.device.linear(ins[1], ins[2]).then(r => { this.executeIp(); }).catch(errorHandler(this, cmd));
        return;
      }

      if (cmd == "batteryLevel") {
        this.device.batteryLevel().then((level) => { 
           this.send(executingId, {batteryLevel: level });
        }).catch(errorHandler(this, cmd));
        return;
      }
   
      if (cmd == "rssiLevel") {
        this.device.rssiLevel().then((level) => { 
           this.send(executingId, {rssiLevel: level });
        }).catch(errorHandler(this, cmd));
        return;
      }
   
      if (cmd == "supported") {
        this.send(executingId, { });
        return;
      }
   
      if (cmd == "loop") {
        this.ip = 0;
        continue;
      }

      this.send(executingId, {error: "Unknown command: " + cmd });
      console.log("Unknown command: " + cmd);
      return;
    }
  }

  buttplugControl = function(name, command, args) {
    var tajDevice = getDeviceByName(name);
    if (!tajDevice) {
      return false;
    }
    return tajDevice.device[command].apply(null, args);
  };

  buttplugPlay = function(id, name, instructions) {
    var tajDevice = getDeviceByName(name);
    if (!tajDevice) {
      return false;
    }

    tajDevice.stop();
    executingId = id;
    tajDevice.execute(instructions);
  };
}

