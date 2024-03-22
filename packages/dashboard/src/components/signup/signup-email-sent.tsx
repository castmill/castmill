import { Component } from "solid-js";

const SignUpEmailSent: Component = () => {
  return (
    <div>
      <h2>Check your Email</h2>

      <p>
        We have sent a verification link to your email. Click the link to
        complete the sign up process. If you do not receive the email, it could
        be that you entered an existing email. Please try again with a different
        email.
      </p>
      <p>
        Feel free to close this tab and come back later to complete the sign up
        process.
      </p>
    </div>
  );
};

export default SignUpEmailSent;
