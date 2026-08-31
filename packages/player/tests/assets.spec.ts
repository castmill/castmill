import { expect } from 'chai';
import { describe, it } from 'mocha';
import { resolveWidgetAssets } from '../src/widgets/template/assets';

describe('resolveWidgetAssets', () => {
  const assets = {
    images: {
      background: { path: 'assets/images/background.webp' },
      remote: { path: 'https://example.com/image.png' },
    },
  };

  it('resolves nested template asset placeholders', () => {
    expect(
      resolveWidgetAssets(
        {
          style: {
            background: 'url({{asset:images.background}})',
          },
          components: [{ opts: { url: '{{asset:images.remote}}' } }],
        },
        assets,
        'my-widget'
      )
    ).to.deep.equal({
      style: {
        background:
          'url(/widget_assets/my-widget/assets/images/background.webp)',
      },
      components: [{ opts: { url: 'https://example.com/image.png' } }],
    });
  });

  it('leaves unknown placeholders intact', () => {
    expect(
      resolveWidgetAssets('{{asset:images.missing}}', assets, 'my-widget')
    ).to.equal('{{asset:images.missing}}');
  });
});
