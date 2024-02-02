import * as dotenv from 'dotenv';

export default class Config {
  private envs: Record<string, any>;

  constructor() {
    this.envs = dotenv.config().parsed || {};
  }

  get(key: string) {
    return this.envs[key];
  }
}
