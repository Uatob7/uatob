import { Car, Calendar, CreditCard, AlertCircle } from "lucide-react";
import { C } from '@/App/SignUp/constants.jsx';
import { InputField, SelectField } from '@/App/SignUp/FormFields.jsx';

const RIDE_TYPES = [
  { id: "standard", label: "Standard", c: "#2563EB", desc: "4 passengers" },
  { id: "xl",       label: "XL",       c: "#16A34A", desc: "6 passengers" },
  { id: "premium",  label: "Premium",  c: "#7C3AED", desc: "Luxury cars"  },
  { id: "economy",  label: "Economy",  c: "#D97706", desc: "Budget rides" },
];

export default function StepVehicle({ data, setData, errors }) {
  const toggleRideType = (id) => {
    setData(d => {
      const cur = d.rideTypes || [];
      return { ...d, rideTypes: cur.includes(id) ? cur.filter(r => r !== id) : [...cur, id] };
    });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <SelectField
            label="Make" icon={Car}
            value={data.make} onChange={v => setData(d => ({ ...d, make: v }))}
            options={[
              { value: "",           label: "Select…"    },
              { value: "Toyota",     label: "Toyota"     },
              { value: "Honda",      label: "Honda"      },
              { value: "Ford",       label: "Ford"       },
              { value: "Chevrolet",  label: "Chevrolet"  },
              { value: "Tesla",      label: "Tesla"      },
              { value: "BMW",        label: "BMW"        },
              { value: "Mercedes",   label: "Mercedes"   },
              { value: "Hyundai",    label: "Hyundai"    },
            ]}
          />
        </div>
        <div style={{ flex: 1 }}>
          <InputField
            label="Model" placeholder="Camry, Civic…"
            value={data.model} onChange={v => setData(d => ({ ...d, model: v }))}
            error={errors.model}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <InputField
            label="Year" placeholder="2020" type="number" icon={Calendar}
            value={data.year} onChange={v => setData(d => ({ ...d, year: v }))}
            error={errors.year}
          />
        </div>
        <div style={{ flex: 1 }}>
          <InputField
            label="Color" placeholder="Pearl White"
            value={data.color} onChange={v => setData(d => ({ ...d, color: v }))}
            error={errors.color}
          />
        </div>
      </div>

      <InputField
        label="License Plate" placeholder="ABC-1234" icon={CreditCard}
        value={data.plate} onChange={v => setData(d => ({ ...d, plate: v }))}
        error={errors.plate} hint="Enter as shown on your registration."
      />

      {/* Ride type selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 10, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>
          Ride Types You Can Offer
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {RIDE_TYPES.map(rt => {
            const selected = data.rideTypes?.includes(rt.id);
            return (
              <div
                key={rt.id}
                onClick={() => toggleRideType(rt.id)}
                style={{
                  background: selected ? rt.c + "14" : C.surfaceRaised,
                  border: `1.5px solid ${selected ? rt.c + "50" : C.border}`,
                  borderRadius: 12, padding: "11px 16px", cursor: "pointer",
                  transition: "all .2s", flex: "1 1 calc(50% - 4px)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: selected ? rt.c : C.text, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".5px" }}>{rt.label}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{rt.desc}</div>
              </div>
            );
          })}
        </div>
        {errors.rideTypes && (
          <div style={{ fontSize: 11.5, color: C.red, marginTop: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <AlertCircle size={11} />{errors.rideTypes}
          </div>
        )}
      </div>

      <InputField
        label="Vehicle VIN" placeholder="1HGBH41JXMN109186"
        value={data.vin} onChange={v => setData(d => ({ ...d, vin: v }))}
        hint="17-character Vehicle Identification Number (optional)"
      />
    </div>
  );
}