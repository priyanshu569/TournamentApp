// Reward photos use ImageCropPreview's free ratio picker (Original, 1:1,
// 3:4, 4:3, 9:16, 16:9) -- same as chat-thread.tsx/world-chat.tsx -- not
// a fixedRatio like the tournament banner. Display containers (catalog
// card, admin thumb, redeem-sheet gallery) are all a fixed square with
// `cover`, so a non-square pick still renders as a clean square; it's
// just center-cropped rather than framed by the admin like a 1:1 pick
// would be.
export const MAX_REWARD_IMAGES = 6;
