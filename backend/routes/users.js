import express from "express";
import {
  createUser,
  getUsers,
  getSuperadmins,
  updateUser,
  deleteUser,
  getSuperadminNames,
  updateMyAlertPhones,
} from "../controllers/userController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/names-superadmins", getSuperadminNames);

router.use(protect);

router.put("/me/alert-phones", authorize("company", "superadmin"), updateMyAlertPhones);
router.get("/superadmins", authorize("company"), getSuperadmins);
router.get("/", authorize("company", "superadmin"), getUsers);
router.post("/", authorize("company"), createUser);
router.put("/:id", authorize("company"), updateUser);
router.delete("/:id", authorize("company"), deleteUser);
export default router;
