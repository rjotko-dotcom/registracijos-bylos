// Static collectible catalog. Unlock records live in IndexedDB.

export interface CollectibleDef {
  id: string;
  i18nKey: string; // collectibles.<key>
  icon: string; // pixel icon key
  secret: boolean; // hide the "how" hint until unlocked
  levelRequired?: number;
}

export const COLLECTIBLES: CollectibleDef[] = [
  { id: 'yellowBall', i18nKey: 'yellowBall', icon: 'ball', secret: false },
  { id: 'pinkPaw', i18nKey: 'pinkPaw', icon: 'pawToy', secret: false },
  { id: 'hiddenPaw', i18nKey: 'hiddenPaw', icon: 'paw', secret: true },
  { id: 'flyHunter', i18nKey: 'flyHunter', icon: 'fly', secret: true },
  { id: 'nightMoth', i18nKey: 'nightMoth', icon: 'moth', secret: true },
  { id: 'box', i18nKey: 'box', icon: 'box', secret: true },
  { id: 'crown', i18nKey: 'crown', icon: 'crown', secret: true },
  { id: 'streak7', i18nKey: 'streak7', icon: 'star', secret: false },
  { id: 'plant', i18nKey: 'plant', icon: 'plant', secret: true },
  { id: 'zoomies', i18nKey: 'zoomies', icon: 'wind', secret: true },
  { id: 'blanket', i18nKey: 'blanket', icon: 'blanket', secret: false, levelRequired: 3 },
  { id: 'moon', i18nKey: 'moon', icon: 'moon', secret: false, levelRequired: 5 },
];
