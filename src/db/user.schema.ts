import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    numericId: Number,
    userName: String,
    payment_queue: {
      type: Number,
      default: 0,
    },
    inProgressMenu: String,
  },
  { timestamps: true },
);

export const User = model('user', schema);
