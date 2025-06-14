// Base repository interface for data access layer

import { PaginatedResponse } from '@shared/types';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  where?: Record<string, any>;
}

export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findOne(query: Record<string, any>): Promise<T | null>;
  findMany(options?: QueryOptions): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(query?: Record<string, any>): Promise<number>;
}

export abstract class BaseRepository<T> implements Repository<T> {
  protected abstract collectionName: string;

  abstract findById(id: string): Promise<T | null>;
  abstract findOne(query: Record<string, any>): Promise<T | null>;
  abstract findMany(options?: QueryOptions): Promise<T[]>;
  abstract create(data: Partial<T>): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T>;
  abstract delete(id: string): Promise<void>;
  abstract count(query?: Record<string, any>): Promise<number>;

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected async paginate(
    options: QueryOptions,
    totalCount: number,
    items: T[]
  ): Promise<PaginatedResponse<T>> {
    const page = Math.floor((options.offset || 0) / (options.limit || 10)) + 1;
    const limit = options.limit || 10;
    const hasMore = totalCount > (options.offset || 0) + items.length;

    return {
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore
      }
    };
  }
}