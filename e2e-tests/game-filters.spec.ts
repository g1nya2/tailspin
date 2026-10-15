import { test, expect } from '@playwright/test';

test.describe('Game Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('games-grid')).toBeVisible();
  });

  test('should display category and publisher filter controls', async ({ page }) => {
    await test.step('Verify the filters panel is visible', async () => {
      await expect(page.getByTestId('game-filters')).toBeVisible();
    });

    await test.step('Verify category checkboxes are rendered', async () => {
      const categoryCheckboxes = page.getByTestId('category-filters').getByRole('checkbox');
      expect(await categoryCheckboxes.count()).toBeGreaterThan(0);
    });

    await test.step('Verify the publisher dropdown is rendered with an "All publishers" default', async () => {
      const publisherSelect = page.getByTestId('publisher-filter');
      await expect(publisherSelect).toBeVisible();
      await expect(publisherSelect.locator('option').first()).toHaveText('All publishers');
    });
  });

  test('filters games by a single category', async ({ page }) => {
    const totalCards = await page.getByTestId('game-card').count();

    await test.step('Select the Strategy category filter', async () => {
      await page.getByTestId('category-filters').getByRole('checkbox', { name: 'Strategy' }).check();
    });

    await test.step('Verify only Strategy games remain visible', async () => {
      const visibleCards = page.getByTestId('game-card').locator('visible=true');
      await expect(visibleCards).toHaveCount(4);
      const categories = await visibleCards.getByTestId('game-category').allTextContents();
      expect(categories.every((c) => c === 'Strategy')).toBe(true);
    });

    await test.step('Verify the filter status announces the match count', async () => {
      await expect(page.getByTestId('filter-status')).toHaveText(`Showing 4 of ${totalCards} games.`);
    });
  });

  test('filters games by multiple categories (OR semantics)', async ({ page }) => {
    await test.step('Select Strategy and Puzzle categories', async () => {
      await page.getByTestId('category-filters').getByRole('checkbox', { name: 'Strategy' }).check();
      await page.getByTestId('category-filters').getByRole('checkbox', { name: 'Puzzle' }).check();
    });

    await test.step('Verify Strategy and Puzzle games are visible', async () => {
      const visibleCards = page.getByTestId('game-card').locator('visible=true');
      await expect(visibleCards).toHaveCount(8);
      const categories = await visibleCards.getByTestId('game-category').allTextContents();
      expect(categories.every((c) => c === 'Strategy' || c === 'Puzzle')).toBe(true);
    });
  });

  test('filters games by publisher', async ({ page }) => {
    await test.step('Select a publisher from the dropdown', async () => {
      await page.getByTestId('publisher-filter').selectOption({ label: 'CodeForge Studios' });
    });

    await test.step('Verify only games from that publisher remain visible', async () => {
      const visibleCards = page.getByTestId('game-card').locator('visible=true');
      await expect(visibleCards).toHaveCount(6);
      const publishers = await visibleCards.getByTestId('game-publisher').allTextContents();
      expect(publishers.every((p) => p === 'CodeForge Studios')).toBe(true);
    });
  });

  test('combines category and publisher filters (AND semantics)', async ({ page }) => {
    await test.step('Select a category and a publisher', async () => {
      await page.getByTestId('category-filters').getByRole('checkbox', { name: 'Strategy' }).check();
      await page.getByTestId('publisher-filter').selectOption({ label: 'CodeForge Studios' });
    });

    await test.step('Verify only games matching both filters remain visible', async () => {
      const visibleCards = page.getByTestId('game-card').locator('visible=true');
      const count = await visibleCards.count();
      expect(count).toBeGreaterThan(0);
      const categories = await visibleCards.getByTestId('game-category').allTextContents();
      const publishers = await visibleCards.getByTestId('game-publisher').allTextContents();
      expect(categories.every((c) => c === 'Strategy')).toBe(true);
      expect(publishers.every((p) => p === 'CodeForge Studios')).toBe(true);
    });
  });

  test('shows an empty state and clears filters to restore the full list', async ({ page }) => {
    const totalCards = await page.getByTestId('game-card').count();

    // The seeded catalog has at least one game for every real category/publisher
    // combination, so no realistic selection yields zero matches. Retarget the
    // cards' category ids to a sentinel value to exercise the genuine
    // zero-match rendering path of the shipped filtering script.
    await test.step('Force a filter selection with no matching games', async () => {
      await page.evaluate(() => {
        document.querySelectorAll<HTMLElement>('[data-testid="game-card"]').forEach((card) => {
          card.dataset.categoryId = 'no-such-category';
        });
      });
      await page.getByTestId('category-filters').getByRole('checkbox', { name: 'Strategy' }).check();
    });

    await test.step('Verify the empty state is shown and the grid is hidden', async () => {
      await expect(page.getByTestId('no-filter-results')).toBeVisible();
      await expect(page.getByTestId('games-grid')).toBeHidden();
    });

    await test.step('Clear filters and verify the full list is restored', async () => {
      await page.getByTestId('clear-filters').click();
      await expect(page.getByTestId('games-grid')).toBeVisible();
      await expect(page.getByTestId('no-filter-results')).toBeHidden();
      await expect(page.getByTestId('game-card').locator('visible=true')).toHaveCount(totalCards);
      await expect(page.getByTestId('filter-status')).toHaveText(`Showing all ${totalCards} games.`);
    });
  });

  test('filter controls are operable with the keyboard', async ({ page }) => {
    await test.step('Tab to and check the first category checkbox with the keyboard', async () => {
      const firstCheckbox = page.getByTestId('category-filters').getByRole('checkbox').first();
      await firstCheckbox.focus();
      await expect(firstCheckbox).toBeFocused();
      await page.keyboard.press('Space');
      await expect(firstCheckbox).toBeChecked();
    });

    await test.step('Verify the filter status updates in response', async () => {
      await expect(page.getByTestId('filter-status')).not.toBeEmpty();
    });
  });
});
