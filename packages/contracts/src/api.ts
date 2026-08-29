export interface AuthTokenRequest {
  userId: string;
}

export interface AuthTokenResponse {
  status: 'success';
  accessToken: string;
}

export interface ProductResponseItem {
  productId: string;
  name: string;
  price: number;
  availableStock: number;
  remainingStock: number;
  isFlashSaleActive: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductsResponse {
  status: 'success';
  data: ProductResponseItem[];
  meta: PaginationMeta;
}

export interface CreateOrderRequest {
  productId: string;
}

export interface OrderAdmissionResponse {
  status: 'processing';
  orderJobId: string;
  message: string;
}

export interface ApiErrorResponse {
  status: 'error';
  code: string;
  message: string;
  requestId: string;
}
