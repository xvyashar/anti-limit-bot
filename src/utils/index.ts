export default class Utils {
  constructor() {}

  getDayOffset(from: Date, to: Date): number {
    const fromUTC = Date.UTC(
      from.getFullYear(),
      from.getMonth(),
      from.getDate(),
    );
    const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());

    const timeDifference = toUTC - fromUTC;
    const dayOffset = Math.floor(timeDifference / (24 * 60 * 60 * 1000));

    return dayOffset;
  }

  async formatConfigs(
    configs: Record<string, any>[],
    subscription: Record<string, any>,
  ) {
    const { customer } = subscription;

    if (!customer) throw new Error('user not populated');
    if (typeof customer === 'string') throw new Error('user not populated');

    let response = '';
    for (const config of configs) {
      const baseConfig = config.url.substring(0, config.url.indexOf('#') + 1);
      response +=
        baseConfig +
        `${config.countryEmoji} [Anti-limit] [${config.isp}] -> ${customer?.userName}` +
        '\n';
    }

    return response;
  }
}
