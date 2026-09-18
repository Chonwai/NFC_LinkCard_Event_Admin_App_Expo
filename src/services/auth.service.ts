import type { ApiResponse, AuthUser, LoginResponse } from "@/types/api.types";

import { apiClient } from "./api";

interface MeResponseData {
  /** UserController.getCurrentUser 回傳結構為 `{ success, data: { user } }` */
  user: AuthUser;
}

export const authService = {
  /** POST /api/auth/login（暫用；後續再切換 promoter claim 路徑） */
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await apiClient.post<ApiResponse<LoginResponse>>(
      "/api/auth/login",
      {
        email,
        password,
      },
    );
    return res.data.data;
  },

  /** GET /api/users/me → `{ success, data: { user } }` */
  async me(): Promise<AuthUser> {
    const res =
      await apiClient.get<ApiResponse<MeResponseData>>("/api/users/me");
    return res.data.data.user;
  },
};
