export const VIP_SOULESS_SHORTS = new Set([
  '3H2D6N',
  '21R01G',
  'CAGCUU',
  'KATANA',
  'KFTANI',
  'O2EA45',
  'CARSON',
  'FUYR7K'
]);

export const VIP_SOULESS_UUIDS = new Set([
  '05fd406f-e037-478d-b701-2a92081be680',
  '6ff75b7d-6de2-449a-9777-520de497d7b8',
  'f0d80479-1f11-4af2-89c6-0cc4908e5c92',
  '0909a116-4e5b-42fb-9f7b-ca9b4f776a26',
  '2005bfe2-4cd9-462c-b09c-d870fdf0d6cd',
  '9c34486b-10ab-4e3f-998f-8f72835f65a8',
  '9760c58b-fc34-425a-8d81-a957ad5a75c1',
  'e45990f7-cb60-48c6-b664-41a0d09d25a1'
]);

/**
 * Returns VIP badge & styling configuration for profile cards
 */
export function getVipProfileInfo(profile) {
  if (!profile) return null;
  const shortId = (profile.shortId || '').trim().toUpperCase().replace(/^#+/, '');
  const id = (profile.id || '').trim().toLowerCase();

  // Yip VIP Tier (#TTTVBJ)
  if (shortId === 'TTTVBJ' || id === '57c35b3e-2b0c-4971-b1b3-c6e3271ece0d') {
    return {
      type: 'yip',
      tag: '⚡ YIP',
      label: 'VIP MEMBER',
      primaryColor: '#527EFF',
      secondaryColor: '#C0F5FF',
      borderColor: '#527EFF',
      glowColor: 'rgba(82, 126, 255, 0.65)',
      gradientStart: 'rgba(82, 126, 255, 0.35)',
      gradientMiddle: 'rgba(6, 18, 38, 0.95)',
      gradientEnd: 'rgba(192, 245, 255, 0.3)'
    };
  }

  // Carson & Souless VIP Tier
  if (VIP_SOULESS_SHORTS.has(shortId) || VIP_SOULESS_UUIDS.has(id)) {
    return {
      type: 'souless',
      tag: '⚡ SOULLESS',
      label: 'VIP MEMBER',
      primaryColor: '#C084FC',
      secondaryColor: '#F5D0FE',
      borderColor: '#A855F7',
      glowColor: 'rgba(168, 85, 247, 0.65)',
      gradientStart: 'rgba(147, 51, 234, 0.35)',
      gradientMiddle: 'rgba(15, 5, 25, 0.95)',
      gradientEnd: 'rgba(192, 132, 252, 0.3)'
    };
  }

  return null;
}
