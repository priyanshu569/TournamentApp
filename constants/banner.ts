// Single source of truth for the tournament banner shape.
//
// The crop frame (ImageCropPreview, via create-tournament/edit-tournament)
// and EVERY place a banner is rendered must use this same ratio. Display
// containers must express it as `aspectRatio`, never a fixed pixel height:
// a fixed height makes the real ratio depend on screen width, so it only
// matches on one device size. Anywhere the two drift, `contentFit: 'cover'`
// silently trims part of what the host framed during cropping.
export const TOURNAMENT_BANNER_RATIO = 22 / 9;
