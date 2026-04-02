import { User, Mail, Lock, Check, AlertCircle } from "lucide-react";
import { C } from '@/App/SignUp/constants.jsx';
import { InputField } from '@/App/SignUp/FormFields.jsx';

export default function StepAccount({ data, setData, errors }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <InputField
            label="First Name"
            placeholder="Marcus"
            icon={User}
            value={data.firstName}
            onChange={v => setData(d => ({ ...d, firstName: v }))}
            error={errors.firstName}
          />
        </div>

        <div style={{ flex: 1 }}>
          <InputField
            label="Last Name"
            placeholder="Johnson"
            value={data.lastName}
            onChange={v => setData(d => ({ ...d, lastName: v }))}
            error={errors.lastName}
          />
        </div>
      </div>

      <InputField
        label="Email Address"
        placeholder="marcus@example.com"
        type="email"
        icon={Mail}
        value={data.email}
        onChange={v => setData(d => ({ ...d, email: v }))}
        error={errors.email}
      />

      <InputField
        label="Password"
        placeholder="Min. 8 characters"
        type="password"
        icon={Lock}
        value={data.password}
        onChange={v => setData(d => ({ ...d, password: v }))}
        error={errors.password}
        hint="Use uppercase, lowercase, numbers, and symbols."
      />

      <InputField
        label="Confirm Password"
        placeholder="Re-enter password"
        type="password"
        icon={Lock}
        value={data.confirmPassword}
        onChange={v => setData(d => ({ ...d, confirmPassword: v }))}
        error={errors.confirmPassword}
      />

      {/* Terms */}
      <div
        style={{
          background: C.surfaceRaised,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "14px 16px",
          display: "flex",
          gap: 12,
          alignItems: "flex-start"
        }}
      >
        <div
          onClick={() => setData(d => ({ ...d, terms: !d.terms }))}
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            border: `1.5px solid ${data.terms ? C.accent : C.border}`,
            background: data.terms ? C.accentGlow : "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {data.terms && <Check size={12} color={C.accent} />}
        </div>

        <div style={{ fontSize: 12.5, color: C.textMid }}>
          I agree to UaTob's{" "}
          <span style={{ color: C.accent }}>Driver Terms</span> and{" "}
          <span style={{ color: C.accent }}>Privacy Policy</span>
        </div>
      </div>

      {errors.terms && (
        <div style={{ color: C.red, marginTop: 6 }}>
          <AlertCircle size={11} /> {errors.terms}
        </div>
      )}
    </div>
  );
}