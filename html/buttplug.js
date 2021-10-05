{
  var client;

  buttplugInitialize = async function () {
    await Buttplug.buttplugInit();

    const connector = new Buttplug.ButtplugEmbeddedConnectorOptions();
    client = new Buttplug.ButtplugClient("TAJ Client");
    await client.connect(connector);

    client.addListener("deviceadded", (device) => {
      console.log(`Device Connected: ${device.Name}`);
      console.log("Client currently knows about these devices:");
      client.Devices.forEach((device) => console.log(`- ${device.Name}`));
    });
    client
      .addListener("deviceremoved", (device) => console.log(`Device Removed: ${device.Name}`));
  }

  buttplugStartScanning = function () {
    client.startScanning();
  }
}

