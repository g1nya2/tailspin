import { eq, asc, and, inArray, type SQL } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game, Category, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

/** Maps a raw joined query row to the app-facing {@link Game} shape. */
function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

/** Shared base select joining games with their category and publisher. */
function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** Options for narrowing {@link getAllGames} results. */
export interface GameFilters {
    /** Match games in any of these category ids (OR'd together). */
    categoryIds?: number[];
    /** Match games with this publisher id. */
    publisherId?: number;
}

/** Builds the AND'd list of SQL conditions for the given {@link GameFilters}. */
function buildGameFilterConditions(filters?: GameFilters): SQL[] {
    const conditions: SQL[] = [];
    if (filters?.categoryIds && filters.categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, filters.categoryIds));
    }
    if (filters?.publisherId !== undefined) {
        conditions.push(eq(games.publisherId, filters.publisherId));
    }
    return conditions;
}

/**
 * All games ordered by title, optionally narrowed by category and/or
 * publisher. Multiple category ids are OR'd together; the category and
 * publisher filters are AND'd when both are provided.
 */
export async function getAllGames(db: Database, filters?: GameFilters): Promise<Game[]> {
    const conditions = buildGameFilterConditions(filters);
    const rows =
        conditions.length > 0
            ? await baseGamesQuery(db)
                  .where(and(...conditions))
                  .orderBy(asc(games.title))
            : await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

/** All categories ordered by name, for populating filter controls. */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
}

/** All publishers ordered by name, for populating filter controls. */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
}
