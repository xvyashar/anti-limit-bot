import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    customer: Schema.Types.ObjectId,
    serviceName: String,
    expiresIn: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

export const Subscription = model('subscription', schema);
