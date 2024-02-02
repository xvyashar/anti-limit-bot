import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    isp: {
      type: String,
      required: true,
    },
    countryEmoji: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export const Config = model('config', schema);
