import { expect, test } from '../../fixtures/test.fixture';

test('OKR supports objective and key result ordering, deletion and persistence', async ({
  page,
  workViewPage,
  settingsPage,
}) => {
  await workViewPage.waitForTaskList();
  await settingsPage.navigateToPluginSettings();
  expect(await settingsPage.enablePlugin('OKR')).toBe(true);
  await page.goto('/#/plugins/okr/index');
  const frame = page.frameLocator('plugin-index iframe');
  const objectives = frame.locator('article');
  await expect(
    frame.getByText('Add an objective, then define its key results.'),
  ).toBeVisible();

  for (const title of ['Learn a language', 'Build a product']) {
    await frame.getByRole('textbox', { name: 'Objective (O)', exact: true }).fill(title);
    await frame.getByRole('button', { name: 'Add objective', exact: true }).click();
    await expect(objectives.filter({ hasText: title })).toHaveCount(1);
  }
  for (const title of ['Read a book', 'Have a conversation']) {
    await objectives.first().getByRole('textbox').fill(title);
    await objectives.first().getByRole('button', { name: 'Add key result' }).click();
    await expect(
      objectives.first().locator('.kr').filter({ hasText: title }),
    ).toHaveCount(1);
  }
  await objectives
    .first()
    .locator('.kr')
    .last()
    .getByRole('button', { name: 'Move up' })
    .click();
  await expect(objectives.first().locator('.kr').first()).toContainText(
    'Have a conversation',
  );
  await objectives
    .first()
    .locator(':scope > .row')
    .getByRole('button', { name: 'Move down' })
    .click();
  await expect(objectives.first()).toContainText('Build a product');

  await objectives
    .last()
    .locator(':scope > .row [draggable]')
    .dragTo(objectives.first().locator(':scope > .row'));
  await expect(objectives.first()).toContainText('Learn a language');
  await objectives
    .first()
    .locator('.kr')
    .first()
    .locator('[draggable]')
    .dragTo(objectives.first().locator('.kr').last());
  await expect(objectives.first().locator('.kr').first()).toContainText('Read a book');
  await objectives
    .first()
    .locator('.kr')
    .last()
    .getByRole('button', { name: 'Move up' })
    .click();
  await objectives
    .first()
    .locator(':scope > .row')
    .getByRole('button', { name: 'Move down' })
    .click();
  await expect(objectives.first()).toContainText('Build a product');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    frame.getByRole('button', { name: 'Add objective', exact: true }),
  ).toBeVisible();
  expect(
    await frame.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.tmp/okr-preview.png' });

  await page.reload();
  await expect(objectives.first()).toContainText('Build a product');
  await expect(objectives.last().locator('.kr').first()).toContainText(
    'Have a conversation',
  );
  await objectives
    .last()
    .locator('.kr')
    .first()
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(objectives.last().locator('.kr')).toHaveCount(1);

  await objectives
    .last()
    .locator(':scope > .row')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await frame.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(objectives).toHaveCount(2);
  await objectives
    .last()
    .locator(':scope > .row')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await frame
    .locator('dialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(objectives).toHaveCount(1);
  await page.reload();
  await expect(objectives).toHaveCount(1);
  await expect(objectives.first()).toContainText('Build a product');

  // Two-month periods: each objective belongs to the period it was created in,
  // the view opens on today's period, and objectives can be carried over.
  const label = frame.locator('#period-label');
  const todayLabel = (await label.textContent()) ?? '';
  expect(todayLabel).not.toBe('');
  await frame.getByRole('button', { name: 'Next period', exact: true }).click();
  await expect(label).not.toHaveText(todayLabel);
  await expect(objectives).toHaveCount(0);
  await frame
    .getByRole('textbox', { name: 'Objective (O)', exact: true })
    .fill('Ship v2');
  await frame.getByRole('button', { name: 'Add objective', exact: true }).click();
  await expect(objectives).toHaveCount(1);
  await frame.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(label).toHaveText(todayLabel);
  await expect(objectives).toHaveCount(1);
  await expect(objectives.first()).toContainText('Build a product');
  await objectives.first().getByRole('textbox').fill('Beta users');
  await objectives.first().getByRole('button', { name: 'Add key result' }).click();
  await expect(objectives.first().locator('.kr')).toHaveCount(1);
  await objectives
    .first()
    .locator(':scope > .row')
    .getByRole('button', { name: 'Carry over to next period', exact: true })
    .click();
  await expect(objectives).toHaveCount(0);
  await page.reload();
  await expect(label).toHaveText(todayLabel);
  await expect(
    frame.getByText('Add an objective, then define its key results.'),
  ).toBeVisible();
  await frame.getByRole('button', { name: 'Next period', exact: true }).click();
  await expect(objectives).toHaveCount(2);
  await expect(objectives.first()).toContainText('Build a product');
  await expect(objectives.first().locator('.kr')).toContainText(['Beta users']);
  await expect(objectives.last()).toContainText('Ship v2');

  // Self-review exists only for periods that already ended: 0–100 % plus one comment.
  await expect(frame.getByRole('button', { name: 'Save review' })).toHaveCount(0);
  await frame.getByRole('button', { name: 'Today', exact: true }).click();
  await frame.getByRole('button', { name: 'Previous period', exact: true }).click();
  await frame
    .getByRole('textbox', { name: 'Objective (O)', exact: true })
    .fill('Launch beta');
  await frame.getByRole('button', { name: 'Add objective', exact: true }).click();
  await expect(objectives).toHaveCount(1);
  await frame.getByRole('slider', { name: 'Self-score: Launch beta' }).fill('80');
  await expect(objectives.first().locator('.review output')).toHaveText('80%');
  await frame
    .getByRole('textbox', { name: 'One-line review: Launch beta' })
    .fill('Shipped, but a week late.');
  await frame.getByRole('button', { name: 'Save review' }).click();
  await expect(objectives.first().locator('.badge')).toHaveText('80%');
  await expect(objectives.first().locator('.comment')).toHaveText(
    'Shipped, but a week late.',
  );
  await page.reload();
  await frame.getByRole('button', { name: 'Previous period', exact: true }).click();
  await expect(objectives.first().locator('.badge')).toHaveText('80%');
  await expect(
    frame.getByRole('slider', { name: 'Self-score: Launch beta' }),
  ).toHaveValue('80');
});
