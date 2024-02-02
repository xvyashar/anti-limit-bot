import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    chatId: {
      type: Number,
      required: true,
    },
    channelName: {
      type: String,
      required: true,
    },
    channelUsername: {
      type: String,
      required: true,
    },
    approved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const Sponsor = model('sponsor', schema);
