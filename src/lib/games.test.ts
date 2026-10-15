import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getAllCategories,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

/** Seeds two categories, two publishers, and a game for each combination. */
async function seedGamesForFiltering(db: Database): Promise<{
    strategyId: number;
    puzzleId: number;
    pubAId: number;
    pubBId: number;
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [pubA] = await db
        .insert(publishers)
        .values({ name: 'Pub A', description: 'pub' })
        .returning({ id: publishers.id });
    const [pubB] = await db
        .insert(publishers)
        .values({ name: 'Pub B', description: 'pub' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Strategy A Game',
            description: 'd',
            starRating: 4.0,
            categoryId: strategy.id,
            publisherId: pubA.id,
        },
        {
            title: 'Strategy B Game',
            description: 'd',
            starRating: 4.0,
            categoryId: strategy.id,
            publisherId: pubB.id,
        },
        {
            title: 'Puzzle A Game',
            description: 'd',
            starRating: 4.0,
            categoryId: puzzle.id,
            publisherId: pubA.id,
        },
        {
            title: 'Puzzle B Game',
            description: 'd',
            starRating: 4.0,
            categoryId: puzzle.id,
            publisherId: pubB.id,
        },
    ]);

    return { strategyId: strategy.id, puzzleId: puzzle.id, pubAId: pubA.id, pubBId: pubB.id };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    describe('filtering', () => {
        it('filters by a single category', async () => {
            const { strategyId } = await seedGamesForFiltering(db);
            const result = await getAllGames(db, { categoryIds: [strategyId] });
            expect(result.map((g) => g.title)).toEqual(['Strategy A Game', 'Strategy B Game']);
        });

        it('filters by multiple categories (OR semantics)', async () => {
            const { strategyId, puzzleId } = await seedGamesForFiltering(db);
            const result = await getAllGames(db, { categoryIds: [strategyId, puzzleId] });
            expect(result.map((g) => g.title)).toEqual([
                'Puzzle A Game',
                'Puzzle B Game',
                'Strategy A Game',
                'Strategy B Game',
            ]);
        });

        it('filters by publisher only', async () => {
            const { pubAId } = await seedGamesForFiltering(db);
            const result = await getAllGames(db, { publisherId: pubAId });
            expect(result.map((g) => g.title)).toEqual(['Puzzle A Game', 'Strategy A Game']);
        });

        it('combines category and publisher filters (AND semantics)', async () => {
            const { strategyId, pubBId } = await seedGamesForFiltering(db);
            const result = await getAllGames(db, { categoryIds: [strategyId], publisherId: pubBId });
            expect(result.map((g) => g.title)).toEqual(['Strategy B Game']);
        });

        it('returns an empty array when no games match the filters', async () => {
            await seedGamesForFiltering(db);
            const result = await getAllGames(db, { categoryIds: [999999] });
            expect(result).toEqual([]);
        });

        it('returns all games when no filters are provided', async () => {
            await seedGamesForFiltering(db);
            const result = await getAllGames(db);
            expect(result).toHaveLength(4);
        });
    });

    describe('getAllCategories', () => {
        it('returns an empty array when there are no categories', async () => {
            expect(await getAllCategories(db)).toEqual([]);
        });

        it('returns categories ordered by name', async () => {
            await db.insert(categories).values([{ name: 'Strategy' }, { name: 'Action' }]);
            const result = await getAllCategories(db);
            expect(result.map((c) => c.name)).toEqual(['Action', 'Strategy']);
        });
    });

    describe('getAllPublishers', () => {
        it('returns an empty array when there are no publishers', async () => {
            expect(await getAllPublishers(db)).toEqual([]);
        });

        it('returns publishers ordered by name', async () => {
            await db.insert(publishers).values([{ name: 'Zeta Games' }, { name: 'Alpha Games' }]);
            const result = await getAllPublishers(db);
            expect(result.map((p) => p.name)).toEqual(['Alpha Games', 'Zeta Games']);
        });
    });
});

