/**
 * Print scaling: each printed page (the report sheet and each activity detail page)
 * is measured at the print width and shrunk only as much as needed to fit one landscape
 * sheet, instead of clipping what does not fit.
 */
import { PRINT_PAGE_HEIGHT, PRINT_PAGE_WIDTH } from '@/modules/projects/report/styles';

const BASE_ZOOM = 0.73; // escala que já cabe numa folha A4 paisagem
const MIN_ZOOM = 0.4; // abaixo disso o texto fica ilegível: a página passa para outra folha

export function computePrintZoom(naturalHeight: number): number {
  if (naturalHeight <= PRINT_PAGE_HEIGHT) return BASE_ZOOM;
  return Math.max(BASE_ZOOM * (PRINT_PAGE_HEIGHT / naturalHeight), MIN_ZOOM);
}

function measure(page: HTMLElement): number {
  const previous = page.getAttribute('style');
  page.style.width = `${PRINT_PAGE_WIDTH}px`;
  page.style.height = 'auto';
  page.style.zoom = '1';
  const height = page.scrollHeight;
  if (previous === null) page.removeAttribute('style');
  else page.setAttribute('style', previous);
  return height;
}

/**
 * Applies the zoom to every page and returns the function that removes it.
 * Pages hidden on screen are shown during the measurement.
 */
export function fitPagesForPrint(pages: HTMLElement[], hiddenContainer: HTMLElement | null): () => void {
  const previousDisplay = hiddenContainer?.style.display ?? '';
  if (hiddenContainer) hiddenContainer.style.display = 'block';
  const zooms = pages.map((page) => computePrintZoom(measure(page)));
  if (hiddenContainer) hiddenContainer.style.display = previousDisplay;
  pages.forEach((page, index) => {
    page.style.zoom = String(zooms[index]);
  });
  return () => pages.forEach((page) => page.style.removeProperty('zoom'));
}
