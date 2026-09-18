import { TOKEN_STORAGE_KEY } from "@/constants/config";
import type { ApiResponse, AuthUser, LoginResponse } from "@/types/api.types";
import { PromoterAccessError } from "@/utils/login-error";
import { tokenStorage } from "@/utils/storage";

import { apiClient } from "./api";

/**
 * `POST /api/v1/promoter/auth/login` envelope（claim token）。
 * 與 `/api/auth/login`（plain user token）不同——後者會讓 my-managed 等 API 401。
 */
interface PromoterLoginEnvelope {
  token: string;
  expiresIn: number;
  user: AuthUser;
}

interface MeEnvelope {
  user: AuthUser;
}

export const authService = {
  /**
   * WP-A1：改走 promoter claim token 路徑（對齊 handoff P-6 / Promoter App T8）。
   *
   * 1. `POST /api/v1/promoter/auth/login` → claim token
   * 2. `GET /api/users/me` → 含 `promoterRole` 的完整身分
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await apiClient.post<ApiResponse<PromoterLoginEnvelope>>(
      "/api/v1/promoter/auth/login",
      { email, password },
    );
    const { token, expiresIn } = res.data.data;

    // 清掉殘留舊 token，避免下一行 me() 被 interceptor 覆寫成舊憑證
    await tokenStorage.deleteItem(TOKEN_STORAGE_KEY);

    const meRes = await apiClient.get<ApiResponse<MeEnvelope>>(
      "/api/users/me",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const user = meRes.data.data.user;

    if (user?.promoterRole == null) {
      throw new PromoterAccessError();
    }

    return { token, expiresIn, user };
  },

  /** GET /api/users/me → `{ success, data: { user } }` */
  async me(): Promise<AuthUser> {
    const res =
      await apiClient.get<ApiResponse<MeEnvelope>>("/api/users/me");
    return res.data.data.user;
  },
};
