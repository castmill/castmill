import { Component } from "solid-js";
import "./footer.scss";

const Footer: Component = () => {
  return (
    <div class="castmill-footer">
      <div class="footer-links">
        <p>© 2011-2024 Castmill™</p>
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
        <a href="#">Contact</a>
        <a href="https://github.com/castmill/castmill" target="_blank">
          Github
        </a>
        <a href="https://x.com/castmill" target="_blank">
          X
        </a>
        <a href="https://www.linkedin.com/company/2871444" target="_blank">
          LinkedIn
        </a>
        <a
          href="https://www.facebook.com/p/Castmill-100063972557827"
          target="_blank"
        >
          Facebook
        </a>
      </div>
    </div>
  );
};

export default Footer;
