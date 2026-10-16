import { expect, it } from 'vitest';
import { buildClusters, groupByFarmer } from '../components/MapView';

it('groups valid farmer coordinates', () => {
  const groups = groupByFarmer([{ id: 1, farmer_lat: 1, farmer_lng: 2 }, { id: 2, farmer_lat: 1, farmer_lng: 2 }, { id: 3, farmer_lat: null, farmer_lng: 2 }]);
  expect(groups).toHaveLength(1); expect(groups[0].products).toHaveLength(2);
});

it('clusters nearby groups and splits them at higher zoom', () => {
  const groups = [{ lat: 1, lng: 1, products: [{}] }, { lat: 1.01, lng: 1.01, products: [{}] }];
  expect(buildClusters(groups, 5)[0].type).toBe('cluster');
  expect(buildClusters(groups, 15)).toHaveLength(2);
  expect(buildClusters([{ lat: 10, lng: 10, products: [{}] }], 5)[0].type).toBe('pin');
});
