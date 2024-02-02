import express from 'express';
import Configs from '../config';
import Utils from '../utils';

import { connectDB, Config, Subscription, User } from '../db';
import { statusPreConfig } from '../constants';

export const bootstrap = () => {
  const app = express();

  const config = new Configs();
  const utils = new Utils();

  connectDB();

  app.get('/sub/:id', async (req, res) => {
    try {
      const { id } = req.params;

      //? find subscriber
      const subscription = await Subscription.findById(id);
      if (!subscription) return res.status(401).send();
      const customer = await User.findById(subscription.customer);
      if (!customer) return res.status(401).send();

      const response = [];

      //? check expiration
      const now = new Date();
      const expiresIn = new Date(subscription.expiresIn);

      if (now >= expiresIn) {
        response.push(`${statusPreConfig}❌ اشتراک شما تمام شده است`);
      } else {
        const dayOffset = utils.getDayOffset(now, expiresIn);
        response.push(
          `${statusPreConfig}📅 از اشتراک شما ${dayOffset} روز باقی مانده است`,
        );

        const configs = await Config.find();
        for (const config of configs) {
          const baseConfig = config.url.substring(
            0,
            config.url.indexOf('#') + 1,
          );
          response.push(
            `${baseConfig}${encodeURIComponent(
              `${config.countryEmoji} [Anti-limit] [${config.isp}] -> ${customer.userName}`,
            )}`,
          );
        }
      }

      res.send(response.join('\n'));
    } catch (error) {
      console.log(error);
      res.status(401).send();
    }
  });

  app.listen(config.get('PORT'), () =>
    console.log(`server is on: ${config.get('PORT')}`),
  );
};
