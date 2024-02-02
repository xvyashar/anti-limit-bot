//* Import Modules
import mongoose from 'mongoose';
import Config from '../config';

export const connectDB = async () => {
  try {
    const config = new Config();

    mongoose.set('strictQuery', false);

    const conn = await mongoose.connect(config.get('DB_URI'));
    console.log(`database connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};
