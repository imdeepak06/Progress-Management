import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Location from '../models/Location.js';

dotenv.config();

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  await User.deleteMany({});
  await Location.deleteMany({});

  // 1. Company
  const company = await User.create({
    name: 'SUPERTECH',
    email: 'supertech@supertech.com',
    password: 'supertech@1978@',
    role: 'company',
  });


  console.log('\n✅ Seed completed!\n');
  console.log('════════════════════════════════════════════════');
  console.log('  LOGIN CREDENTIALS');
  console.log('════════════════════════════════════════════════');
  console.log('  Company   : supertech@supertech.com     / supertech@1978@');
  console.log('════════════════════════════════════════════════\n');

  process.exit(0);
};

seed().catch(e => { console.error(e); process.exit(1); });
