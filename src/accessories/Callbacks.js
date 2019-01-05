export function getPowerState(callback) {
  const { platform } = this;
  const { api } = platform;
  const jsonMessage = `${JSON.stringify({
    DeviceId: this.id,
    DeviceType: this.type,
    MessageType: 'Request',
    Operation: 'Get',
    Property: 'Power'
  })}||`;
  platform.socket.write(jsonMessage);
  platform.socket.pendingGetRequests.set(
    `${this.type}-${this.id}-Power`,
    jsonMessage
  );

  // handle response to `Get` Power requests
  api.once(`Response-${this.type}-${this.id}-Get-Power`, value => {
    platform.socket.pendingGetRequests.delete(`${this.type}-${this.id}-Power`);
    const powered = Boolean(value);
    callback(null, powered);
  });
}

export function setPowerState(powered, callback) {
  const { platform } = this;
  const { api } = platform;
  const jsonMessage = `${JSON.stringify({
    DeviceId: this.id,
    DeviceType: this.type,
    MessageType: 'Request',
    Operation: 'Set',
    Property: 'Power',
    Value: powered ? 1 : 0
  })}||`;

  /*
    Logic to handle Apple's Home app Dimmer behavior:

    Apple's Home app sets a Power and Brightness characteristic when interacting
    with dimmer controls. If both `Power` and `Level` messages are received by
    Crestron in rapid succession, the Brightness/Level setting may be lost due to
    a potential analog ramp triggered on the dimmer.

    (Note: When powering off the dimmer, only the Power is set and no Brightness
    is set)

    To work around this behavior, we first check if the `Set Power` command is
    from a dimmer and if the command is to `Power On` the device. If the device
    is already powered on, we stop any further processing and notify Homebridge.
    We check on the device's `On` state by reading the value from the `On`
    characteristic in the `lighBulbService`.

    If the device is off, we pause processing for 50 ms and wait for a `Set Level`
    event to fire for the same device. If no event is fired for `Set Level`, we
    will process the `Set Power` request, otherwise we simply notify Homebridge
    that the `Set Power` was successful and we delegate the command to the
    Brightness characteristic
   */
  if (this.type === 'LightDimmer' && powered) {
    let isLevelAlsoSet = false;

    if (this.lightBulbService.characteristics[0].value) {
      callback();

      return;
    }

    setTimeout(() => {
      if (!isLevelAlsoSet) {
        this.platform.socket.write(jsonMessage);
        platform.socket.pendingSetRequests.set(
          `${this.type}-${this.id}-Power`,
          jsonMessage
        );

        api.once(`Response-${this.type}-${this.id}-Set-Power`, () => {
          platform.socket.pendingSetRequests.delete(
            `${this.type}-${this.id}-Power`
          );
          callback();
        });
      } else {
        callback();
      }
    }, 50);

    api.once(`Request-${this.type}-${this.id}-Set-Level`, () => {
      isLevelAlsoSet = true;
    });
  } else {
    this.platform.socket.write(jsonMessage);
    platform.socket.pendingSetRequests.set(
      `${this.type}-${this.id}-Power`,
      jsonMessage
    );

    api.once(`Response-${this.type}-${this.id}-Set-Power`, () => {
      platform.socket.pendingSetRequests.delete(
        `${this.type}-${this.id}-Power`
      );
      callback();
    });
  }
}

export function getLightLevel(callback) {
  const { platform } = this;
  const { api } = platform;
  const jsonMessage = `${JSON.stringify({
    DeviceId: this.id,
    DeviceType: this.type,
    MessageType: 'Request',
    Operation: 'Get',
    Property: 'Level'
  })}||`;

  platform.socket.write(jsonMessage);
  platform.socket.pendingGetRequests.set(
    `${this.type}-${this.id}-'Level'`,
    jsonMessage
  );

  api.once(`Response-${this.type}-${this.id}-Get-Level`, value => {
    platform.socket.pendingGetRequests.delete(`${this.type}-${this.id}-Level`);
    const percentLevel = (value * 100) / 65535;
    callback(null, percentLevel);
  });
}

export function setLightLevel(percentLevel, callback) {
  const { platform } = this;
  const { api } = platform;
  const jsonMessage = `${JSON.stringify({
    DeviceId: this.id,
    DeviceType: this.type,
    MessageType: 'Request',
    Operation: 'Set',
    Property: 'Level',
    Value: (percentLevel / 100) * 65535
  })}||`;

  this.platform.socket.write(jsonMessage);
  api.emit(`Request-${this.type}-${this.id}-Set-Level`);
  platform.socket.pendingSetRequests.set(
    `${this.type}-${this.id}-Level`,
    jsonMessage
  );

  api.once(`Response-${this.type}-${this.id}-Set-Level`, () => {
    platform.socket.pendingSetRequests.delete(`${this.type}-${this.id}-Level`);
    callback();
  });
}
