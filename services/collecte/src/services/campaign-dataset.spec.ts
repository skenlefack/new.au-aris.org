import { describe, it, expect } from 'vitest';
import { collectFieldDictionary, type CampaignDataset } from './submission.service';

describe('collectFieldDictionary', () => {
  it('records labels and option labels, including repeater sub-fields', () => {
    const schema = {
      sections: [
        {
          fields: [
            {
              id: 'clinical_signs', code: 'clinical_signs', type: 'multi-select',
              label: { en: 'Clinical signs', fr: 'Signes cliniques' },
              properties: { options: [{ value: 'fever', label: { en: 'Fever', fr: 'Fièvre' } }] },
            },
            {
              id: 'animal_movements', code: 'animal_movements', type: 'repeater', label: { en: 'Movements' },
              properties: {
                fields: [
                  { id: 'movement_direction', code: 'movement_direction', type: 'select', label: 'Direction', properties: { options: [{ value: 'in', label: 'In' }] } },
                ],
              },
            },
            { id: 'goats_count', type: 'number', label: { en: 'Goats' } },
          ],
        },
      ],
    };
    const out: CampaignDataset['fields'] = {};
    collectFieldDictionary(schema, out);

    expect(out['clinical_signs']).toEqual({
      label: { en: 'Clinical signs', fr: 'Signes cliniques' },
      type: 'multi-select',
      options: { fever: { en: 'Fever', fr: 'Fièvre' } },
    });
    expect(out['movement_direction'].options).toEqual({ in: { en: 'In' } });
    expect(out['goats_count']).toEqual({ label: { en: 'Goats' }, type: 'number' });
  });

  it('ignores malformed schemas', () => {
    const out: CampaignDataset['fields'] = {};
    collectFieldDictionary(null, out);
    collectFieldDictionary({ sections: 'x' }, out);
    expect(out).toEqual({});
  });
});
