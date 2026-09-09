import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('');
});

test('starts with an empty transparent page without opening the appointment dialog', async ({ page }) => {
    await expect(page.getByText('Publisher', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Termin auswählen' })).toHaveCount(0);
    await expect(page.locator('.publisher-page-entry')).toHaveCount(1);
    await expect(page.locator('.publisher-page-card__preview img')).toHaveCount(1);
    await expect(page.locator('.template-preview canvas')).toHaveCount(3);
});

test('creates differently sized blank pages without injecting a standard layout', async ({ page }) => {
    await page.getByRole('button', { name: 'Seite hinzufügen' }).first().click();
    await expect(page.getByRole('heading', { name: 'Neue Seite' })).toBeVisible();
    await page.getByLabel('Breite in Pixeln').fill('600');
    await page.getByLabel('Höhe in Pixeln').fill('600');
    await page.getByRole('button', { name: 'Seite anlegen' }).click();

    await expect(page.locator('.publisher-page-entry')).toHaveCount(2);
    await expect(page.locator('.publisher-page-entry').nth(1)).toContainText('600 × 600 px');
    await expect(page.locator('.publisher-page-entry').nth(1).locator('.publisher-page-card__preview-empty')).toBeVisible();
    await expect(page.locator('.publisher-statusbar')).toContainText('Seite 2 · 600 × 600 px');
});

test('keeps canvas selection scoped to the active page', async ({ page }) => {
    await page.getByRole('button', { name: 'Grafiktext hinzufügen' }).click();
    await expect(page.locator('.publisher-statusbar')).toContainText('1 Element ausgewählt');
    await expect(page.getByLabel('X-Position')).toBeEnabled();

    await page.getByRole('button', { name: 'Seite hinzufügen' }).first().click();
    await page.getByRole('button', { name: 'Seite anlegen' }).click();

    await expect(page.locator('.publisher-statusbar')).not.toContainText('Element ausgewählt');
    await expect(page.getByLabel('X-Position')).toBeDisabled();
    await page.locator('.publisher-page-card').first().click();
    await expect(page.getByLabel('X-Position')).toBeDisabled();
});

test('creates a real group target and stores effects on that group', async ({ page }) => {
    await page.getByRole('button', { name: 'Grafiktext hinzufügen' }).click();
    await page.getByRole('button', { name: 'Quadrat hinzufügen' }).click();

    const textLayer = page.locator('.inspector-layer-list__select').filter({ hasText: 'Neuer Text' });
    const shapeLayer = page.locator('.inspector-layer-list__select').filter({ hasText: 'Quadrat' });
    await textLayer.click();
    await shapeLayer.click({ modifiers: ['Shift'] });
    await page.locator('.publisher-layer-popover .design-popover__trigger').click();
    await page.getByRole('button', { name: 'Gruppieren', exact: true }).click();

    await expect(page.locator('.inspector-layer-list__row--group')).toHaveClass(/is-selected/);
    await page.locator('.inspector-layer-footer').getByRole('button', { name: 'Ebeneneffekte' }).click();
    await page.getByLabel('Schlagschatten aktivieren').check();
    await page.getByRole('button', { name: 'Anwenden', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Gruppeneffekte bearbeiten' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Effekte von Neuer Text bearbeiten' })).toHaveCount(0);
});

test('saves and reapplies a complete multi-page document template', async ({ page }) => {
    await page.getByRole('button', { name: 'Seite hinzufügen' }).first().click();
    await page.getByLabel('Breite in Pixeln').fill('600');
    await page.getByLabel('Höhe in Pixeln').fill('600');
    await page.getByRole('button', { name: 'Seite anlegen' }).click();
    await page.getByRole('button', { name: 'Vorlagen', exact: true }).click();

    await page.getByLabel('Vorlagenname').fill('Mehrseiten-Test');
    await page.getByRole('button', { name: 'Aktuelles Dokument speichern' }).click();
    let savedTemplate = page.locator('.design-template-list article').filter({ hasText: 'Mehrseiten-Test' });
    await expect(savedTemplate).toContainText('2 Seiten · 1920 × 1080, 600 × 600');

    await page.getByRole('button', { name: 'Dialog schließen' }).click();
    await page.getByRole('button', { name: 'Seite 2 löschen' }).click();
    await expect(page.locator('.publisher-page-entry')).toHaveCount(1);
    await page.getByRole('button', { name: 'Vorlagen', exact: true }).click();
    savedTemplate = page.locator('.design-template-list article').filter({ hasText: 'Mehrseiten-Test' });
    await savedTemplate.getByRole('button', { name: 'Anwenden' }).click();

    await expect(page.locator('.publisher-page-entry')).toHaveCount(2);
    await expect(page.locator('.publisher-page-entry').nth(1)).toContainText('600 × 600 px');
});

test('keeps image upload entry points visible and explains that upload is coming later', async ({ page }) => {
    await page.getByRole('button', { name: 'Bild hinzufügen' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Eigene Bilder können bald über ChurchTools hochgeladen werden.' }))
        .toBeVisible();
    await expect(page.locator('.publisher-toolrail input[type="file"]')).toHaveCount(0);
});

test('stores a document without an appointment and exposes the save state', async ({ page }) => {
    await page.getByRole('button', { name: 'Vorlagen', exact: true }).click();
    await page.getByLabel('Dokumentname').fill('Freie Grafik');
    await page.getByRole('button', { name: 'Jetzt speichern' }).click();

    const document = page.getByLabel('Gespeicherte Dokumente').locator('article').filter({ hasText: 'Freie Grafik' });
    await expect(document).toContainText('Ohne Termin');
    await expect(page.locator('.publisher-statusbar__storage')).toHaveText('In ChurchTools gespeichert');
});

test('keeps pages and properties available as drawers at tablet width', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    const pagesDrawer = page.locator('#publisher-pages-drawer');
    const inspectorDrawer = page.locator('#publisher-inspector-drawer');

    await expect(pagesDrawer).toHaveAttribute('aria-hidden', 'true');
    await page.getByRole('button', { name: 'Seitenübersicht öffnen' }).click();
    await expect(pagesDrawer).toBeVisible();
    await expect(pagesDrawer).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(pagesDrawer).toHaveAttribute('aria-hidden', 'true');

    await page.getByRole('button', { name: 'Eigenschaften öffnen' }).click();
    await expect(inspectorDrawer).toBeVisible();
    await expect(inspectorDrawer).toHaveAttribute('aria-hidden', 'false');
    await expect(inspectorDrawer.getByRole('tab', { name: 'Ebenen' })).toBeVisible();
});
