import { JsonWidget, TemplateComponentType } from "@castmill/player";
import castmillLogo from "./castmill-logo.png";

export const intro: Omit<JsonWidget, "id"> = {
  name: "Intro",
  description: "An intro widget with a Castmill logo",
  template: {
    type: TemplateComponentType.Image,
    name: "logo",
    opts: {
      url: castmillLogo,
      size: "contain"
    },
    style: {
      "background-size": "contain",
    },
    animations: [
      {
        keyframes: [
          {
            set: {
              filter: "blur(0px)",
            },
            from: {
              filter: "blur(100px)",
              duration: 2,
              ease: "power1.inOut",
            },
            to: {
              translateX: "-40%",
              translateY: "45%",
              scale: 0.2,
              duration: 1,
              ease: "power1.inOut",
            },
          },
          {
            to: {
              translateX: "40%",
              translateY: "45%",
              duration: 1,
              ease: "power1.inOut",
            },
          },
          {
            to: {
              translateX: "40%",
              translateY: "-45%",
              duration: 1,
              ease: "power1.inOut",
            },
          },
          {
            to: {
              translateX: "-40%",
              translateY: "-45%",
              duration: 1,
              ease: "power1.inOut",
            },
          },
          {
            to: {
              translateX: "0%",
              translateY: "0%",
              scale: 1,
              duration: 1,
              ease: "power1.inOut",
            },
          },
          {
            to: {
              filter: "blur(100px)",
              duration: 3,
              ease: "power1.inOut",
            },
          },
        ],
      },
    ],
  }
}

export default intro;