import { BaseAccessory } from './BaseAccessory';
import {
  getLightLevel,
  getPowerState,
  setLightLevel,
  setPowerState
} from './Callbacks';

export class LightDimmer extends BaseAccessory {
  constructor(log, accessoryConfig, platform) {
    super(log, accessoryConfig, platform);
  }

  getServices() {
    const { platform } = this;
    const { api } = platform;
    const {
      hap: { Characteristic, Service }
    } = api;

    const lightBulbService = new Service.Lightbulb();
    const powerState = lightBulbService
      .getCharacteristic(Characteristic.On)
      .on('get', getPowerState.bind(this))
      .on('set', setPowerState.bind(this));

    const lightLevel = lightBulbService
      .getCharacteristic(Characteristic.Brightness)
      .on('get', getLightLevel.bind(this))
      .on('set', setLightLevel.bind(this));

    this.lightBulbService = lightBulbService;

    api.on(`Event-${this.type}-${this.id}-Set-Power`, value => {
      powerState.updateValue(Boolean(value));
    });

    api.on(`Event-${this.type}-${this.id}-Set-Level`, value => {
      lightLevel.updateValue((value * 100) / 65535);
    });

    return [this.infoService, lightBulbService];
  }
}
