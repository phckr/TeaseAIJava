{
  var client;
  // Our wrapper for actual devices
  var tajDevices = {};

  buttplugInitialize = async function () {
    await Buttplug.buttplugInit();

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
    });
    client
      .addListener("deviceremoved", (device) => {
        console.log(`Device Removed: ${device.Name}`)
        tajDevices[device.Name] = null;
      });
  }

  buttplugStartScanning = function () {
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

  function tajDeviceSend(info) {
    var msg = { device: this.device.Name, info: info };
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
      thisVal.send({error: err, command: cmd, device: this.device.Name });
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
           this.send({batteryLevel: level, allowedMessages: this.AllowedMessages() });
        }).catch(errorHandler(this, cmd));
        return;
      }
   
      if (cmd == "rssiLevel") {
        this.device.rssiLevel().then((level) => { 
           this.send({rssiLevel: level, allowedMessages: this.AllowedMessages() });
        }).catch(errorHandler(this, cmd));
        return;
      }
   
      if (cmd == "supported") {
        this.send({allowedMessages: this.AllowedMessages() });
        return;
      }
   
      if (cmd == "loop") {
        this.ip = 0;
        continue;
      }

      this.send({error: "Unknown command: " + cmd, allowedMessages: this.AllowedMessages() });
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

  buttplugPlay = function(name, instructions) {
    var tajDevice = getDeviceByName(name);
    if (!tajDevice) {
      return false;
    }

    tajDevice.stop();
    tajDevice.execute(instructions);
  };
}

