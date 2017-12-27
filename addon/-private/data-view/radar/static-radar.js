import { DEBUG } from '@glimmer/env';

import Radar from './radar';

export default class StaticRadar extends Radar {
  constructor(parentToken, options) {
    super(parentToken, options);

    this._firstItemIndex = 0;
    this._lastItemIndex = 0;

    if (DEBUG) {
      Object.preventExtensions(this);
    }
  }

  _updateIndexes() {
    const {
      bufferSize,
      totalItems,
      estimateHeight,
      estimateWidth,
      visibleMiddleVertical,
      visibleMiddleHorizontal,
      _calculatedEstimateHeight,
      _calculatedEstimateWidth,
      _calculatedScrollContainerHeight,
      _calculatedScrollContainerWidth
    } = this;

    if (totalItems === 0) {
      this._firstItemIndex = 0;
      this._lastItemIndex = -1;

      return;
    }

    const maxIndex = totalItems - 1;

    let middleItemIndex,
      shouldRenderCount;

    if (estimateHeight) {
      middleItemIndex = Math.floor(visibleMiddleVertical / _calculatedEstimateHeight);
      shouldRenderCount = Math.min(Math.ceil(_calculatedScrollContainerHeight / _calculatedEstimateHeight), totalItems);
    } else if (estimateWidth) {
      middleItemIndex = Math.floor(visibleMiddleHorizontal / _calculatedEstimateWidth);
      shouldRenderCount = Math.min(Math.ceil(_calculatedScrollContainerWidth / _calculatedEstimateWidth), totalItems);
    }

    let firstItemIndex = middleItemIndex - Math.floor(shouldRenderCount / 2);
    let lastItemIndex = middleItemIndex + Math.ceil(shouldRenderCount / 2) - 1;

    if (firstItemIndex < 0) {
      firstItemIndex = 0;
      lastItemIndex = shouldRenderCount - 1;
    }

    if (lastItemIndex > maxIndex) {
      lastItemIndex = maxIndex;
      firstItemIndex = maxIndex - (shouldRenderCount - 1);
    }

    firstItemIndex = Math.max(firstItemIndex - bufferSize, 0);
    lastItemIndex = Math.min(lastItemIndex + bufferSize, maxIndex);

    this._firstItemIndex = firstItemIndex;
    this._lastItemIndex = lastItemIndex;
  }

  _didEarthquake(scrollDiff) {
    if (this.estimateHeight) {
      return scrollDiff > (this._calculatedEstimateHeight / 2);
    }
    return scrollDiff > (this._calculatedEstimateWidth / 2);
  }

  get total() {
    if (this.estimateHeight) {
      return this.totalItems * this._calculatedEstimateHeight;
    }
    return this.totalItems * this._calculatedEstimateWidth;
  }

  get totalBefore() {
    if (this.estimateHeight) {
      return this.firstItemIndex * this._calculatedEstimateHeight;
    }
    return this.firstItemIndex * this._calculatedEstimateWidth;
  }

  get totalAfter() {
    if (this.estimateHeight) {
      return this.total - ((this.lastItemIndex + 1) * this._calculatedEstimateHeight);
    }
    return this.total - ((this.lastItemIndex + 1) * this._calculatedEstimateWidth);
  }

  get firstItemIndex() {
    return this._firstItemIndex;
  }

  get lastItemIndex() {
    return this._lastItemIndex;
  }

  get firstVisibleIndex() {
    if (this.estimateHeight) {
      return Math.ceil(this.visibleTop / this._calculatedEstimateHeight);
    }
    return Math.ceil(this.visibleLeft / this._calculatedEstimateWidth);
  }

  get lastVisibleIndex() {
    if (this.estimateHeight) {
      return Math.min(Math.ceil(this.visibleTop / this._calculatedEstimateHeight), this.totalItems) - 1;
    }
    return Math.min(Math.ceil(this.visibleRight / this._calculatedEstimateWidth), this.totalItems) - 1;
  }

  /*
   * Public API to query for the offset of an item
   */
  getOffsetForIndex(index) {
    if (this.estimateHeight) {
      return index * this._calculatedEstimateHeight + 1;
    }
    return index * this._calculatedEstimateWidth + 1;
  }
}
