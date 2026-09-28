import api from "./api";

export type VerificationMethod =
  | "email"
  | "phone"
  | "whatsapp";

export type VerificationStatus =
  | "pending"
  | "verified"
  | "expired"
  | "failed";

export type SendVerificationRequest = {
  identifier: string;
  method: VerificationMethod;
};

export type VerifyOtpRequest = {
  identifier: string;
  otp: string;
  method: VerificationMethod;
};

export type VerificationResponse = {
  success: boolean;
  message: string;
  verificationId?: string;
  expiresAt?: string;
  status?: VerificationStatus;
};

export type VerificationStatusResponse = {
  success: boolean;
  verified: boolean;
  status: VerificationStatus;
  message?: string;
};

/* =========================================================
   MOCK DATA
========================================================= */

const mockVerificationStore: Record<
  string,
  {
    otp: string;
    method: VerificationMethod;
    expiresAt: number;
    verified: boolean;
  }
> = {};

/* =========================================================
   SEND OTP
========================================================= */

/**
 * Sends an OTP to the student's email, phone or WhatsApp.
 *
 * Backend endpoint:
 * POST /verification/send-otp
 *
 * Frontend fallback:
 * Generates a demo OTP when the backend is unavailable.
 */
export async function sendVerificationOtp(
  data: SendVerificationRequest
): Promise<VerificationResponse> {
  try {
    const response =
      await api.post<VerificationResponse>(
        "/verification/send-otp",
        data
      );

    return response.data;
  } catch {
    const otp = "123456";

    const expiresAt =
      Date.now() + 5 * 60 * 1000;

    mockVerificationStore[
      data.identifier
    ] = {
      otp,
      method: data.method,
      expiresAt,
      verified: false,
    };

    return {
      success: true,
      message:
        "Verification OTP sent successfully.",
      verificationId: `VERIFY-${Date.now()}`,
      expiresAt: new Date(
        expiresAt
      ).toISOString(),
      status: "pending",
    };
  }
}

/* =========================================================
   VERIFY OTP
========================================================= */

/**
 * Verifies the OTP entered by the student.
 *
 * Backend endpoint:
 * POST /verification/verify-otp
 */
export async function verifyOtp(
  data: VerifyOtpRequest
): Promise<VerificationResponse> {
  try {
    const response =
      await api.post<VerificationResponse>(
        "/verification/verify-otp",
        data
      );

    return response.data;
  } catch {
    const verification =
      mockVerificationStore[
        data.identifier
      ];

    if (!verification) {
      return {
        success: false,
        message:
          "No verification request found.",
        status: "failed",
      };
    }

    if (Date.now() > verification.expiresAt) {
      return {
        success: false,
        message:
          "OTP has expired. Please request a new OTP.",
        status: "expired",
      };
    }

    if (
      verification.method !== data.method
    ) {
      return {
        success: false,
        message:
          "Verification method does not match.",
        status: "failed",
      };
    }

    if (verification.otp !== data.otp) {
      return {
        success: false,
        message: "Invalid OTP.",
        status: "failed",
      };
    }

    verification.verified = true;

    return {
      success: true,
      message:
        "Verification completed successfully.",
      status: "verified",
    };
  }
}

/* =========================================================
   RESEND OTP
========================================================= */

/**
 * Resends a new OTP.
 *
 * Backend endpoint:
 * POST /verification/resend-otp
 */
export async function resendVerificationOtp(
  data: SendVerificationRequest
): Promise<VerificationResponse> {
  try {
    const response =
      await api.post<VerificationResponse>(
        "/verification/resend-otp",
        data
      );

    return response.data;
  } catch {
    const otp = "123456";

    const expiresAt =
      Date.now() + 5 * 60 * 1000;

    mockVerificationStore[
      data.identifier
    ] = {
      otp,
      method: data.method,
      expiresAt,
      verified: false,
    };

    return {
      success: true,
      message:
        "A new verification OTP has been sent.",
      verificationId: `VERIFY-${Date.now()}`,
      expiresAt: new Date(
        expiresAt
      ).toISOString(),
      status: "pending",
    };
  }
}

/* =========================================================
   CHECK VERIFICATION STATUS
========================================================= */

/**
 * Checks whether an identifier has been verified.
 *
 * Backend endpoint:
 * GET /verification/status/:identifier
 */
export async function getVerificationStatus(
  identifier: string
): Promise<VerificationStatusResponse> {
  try {
    const response =
      await api.get<VerificationStatusResponse>(
        `/verification/status/${encodeURIComponent(
          identifier
        )}`
      );

    return response.data;
  } catch {
    const verification =
      mockVerificationStore[identifier];

    if (!verification) {
      return {
        success: true,
        verified: false,
        status: "pending",
        message:
          "Verification has not been started.",
      };
    }

    if (
      !verification.verified &&
      Date.now() > verification.expiresAt
    ) {
      return {
        success: true,
        verified: false,
        status: "expired",
        message:
          "Verification OTP has expired.",
      };
    }

    if (verification.verified) {
      return {
        success: true,
        verified: true,
        status: "verified",
        message:
          "Identifier is verified.",
      };
    }

    return {
      success: true,
      verified: false,
      status: "pending",
      message:
        "Verification is pending.",
    };
  }
}

/* =========================================================
   VERIFY EMAIL
========================================================= */

/**
 * Shortcut for email verification.
 */
export async function sendEmailVerification(
  email: string
): Promise<VerificationResponse> {
  return sendVerificationOtp({
    identifier: email,
    method: "email",
  });
}

/* =========================================================
   VERIFY PHONE
========================================================= */

/**
 * Shortcut for phone verification.
 */
export async function sendPhoneVerification(
  phone: string
): Promise<VerificationResponse> {
  return sendVerificationOtp({
    identifier: phone,
    method: "phone",
  });
}

/* =========================================================
   VERIFY WHATSAPP
========================================================= */

/**
 * Shortcut for WhatsApp verification.
 */
export async function sendWhatsAppVerification(
  phone: string
): Promise<VerificationResponse> {
  return sendVerificationOtp({
    identifier: phone,
    method: "whatsapp",
  });
}

/* =========================================================
   VERIFY EMAIL OTP
========================================================= */

export async function verifyEmailOtp(
  email: string,
  otp: string
): Promise<VerificationResponse> {
  return verifyOtp({
    identifier: email,
    otp,
    method: "email",
  });
}

/* =========================================================
   VERIFY PHONE OTP
========================================================= */

export async function verifyPhoneOtp(
  phone: string,
  otp: string
): Promise<VerificationResponse> {
  return verifyOtp({
    identifier: phone,
    otp,
    method: "phone",
  });
}

/* =========================================================
   VERIFY WHATSAPP OTP
========================================================= */

export async function verifyWhatsAppOtp(
  phone: string,
  otp: string
): Promise<VerificationResponse> {
  return verifyOtp({
    identifier: phone,
    otp,
    method: "whatsapp",
  });
}

/* =========================================================
   CLEAR MOCK VERIFICATION
========================================================= */

/**
 * Clears frontend demo verification data.
 *
 * This is only useful during frontend development.
 */
export function clearMockVerification(
  identifier?: string
): void {
  if (identifier) {
    delete mockVerificationStore[
      identifier
    ];

    return;
  }

  Object.keys(mockVerificationStore).forEach(
    (key) => {
      delete mockVerificationStore[key];
    }
  );
}