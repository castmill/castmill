import { JsonWidget, TemplateComponentType } from '@castmill/player';
import castmillLogo from './castmill-logo.png';

export const intro: Omit<JsonWidget, 'id'> = {
  name: 'Intro',
  description: 'An intro widget with a Castmill logo',
  template: {
    type: TemplateComponentType.Image,
    name: 'logo',
    opts: {
      url: castmillLogo,
      size: 'contain',
    },
    style: {
      'background-size': 'contain',
    },
    animations: [
      {
        keyframes: [
          {
            set: {
              rotateX: '0deg',
              rotateZ: '0deg',
              translateX: '-70%',
              translateY: '-40%',
              scale: 0.2,
            },
          },
          {
            to: {
              rotateX: '0deg',
              rotateZ: '0deg',
              translateX: '0%',
              translateY: '-40%',
              scale: 0.2,
              duration: 2,
              ease: 'power1.inOut',
            },
          },
          {
            to: {
              translateY: '30%',
              rotateX: '40deg',
              scale: 0.5,
              duration: 3,
              ease: 'bounce.out',
            },
          },
          {
            to: {
              rotateX: '86deg',
              translateY: '37%',
              duration: 1,
              ease: 'circ.in',
            },
          },
          {
            to: {
              translateY: '0%',
              translateX: '20%',
              rotateZ: '30deg',
              rotateX: '80deg',
              scale: 0,
              duration: 4,
              ease: 'power2.in',
            },
          },
        ],
      },
    ],
  },
};

export default intro;
