// Firebase password reset function
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { firebase_app } from "@/firebase/config";

const auth = getAuth(firebase_app);

export default async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return {
      success: true,
      message: "Password reset link sent to your email",
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: error.code,
        message:
          error.code === "auth/user-not-found"
            ? "No account found with this email"
            : error.code === "auth/invalid-email"
            ? "Please enter a valid email address"
            : "Unable to send reset email. Please try again.",
      },
    };
  }
}
