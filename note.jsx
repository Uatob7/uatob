// File: components/RepostFinalPayment.jsx
import React, { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { IconRepeat } from "@tabler/icons-react";
import { CreditCard, DollarSign } from "lucide-react";

/* ---------------- ANIMATIONS ---------------- */
const pop = keyframes`
  0% { transform: scale(0.6); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const blink = keyframes`
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideInFromBottom = keyframes`
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
`;

/* ---------------- STYLES ---------------- */
const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  z-index: 9999;
  animation: ${fadeIn} 0.3s ease-out;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
`;

const ModalCard = styled.div`
  background: #fff;
  width: 90%;
  height: 100%;
  position: relative;
  overflow-y: auto;
  animation: ${slideInFromBottom} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  padding: 60px 20px 40px;
  
  @media (min-width: 768px) {
    padding: 80px 40px 60px;
    max-width: 500px;
    margin: 0 auto;
    border-radius: 0;
  }
`;

const CloseButton = styled.button`
  position: fixed;
  top: 16px;
  right: 16px;
  width: 44px;
  height: 44px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 50%;
  font-size: 24px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  
  &:hover { 
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const ContentWrapper = styled.div`
  max-width: 420px;
  margin: 0 auto;
  height: 90%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 60px;
  
  /* Hide scrollbar for all browsers */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
  
  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }
`;

const TitleWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 8px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #111;
  text-align: center;
  line-height: 1.3;
`;

const Subtitle = styled.p`
  margin: 0 0 24px;
  font-size: 15px;
  font-weight: 400;
  color: #666;
  text-align: center;
  line-height: 1.5;
`;

const AvatarWrapper = styled.div`
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 20px;
`;

const Avatar = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #f0f0f0;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  transition: transform 0.2s;
  cursor: pointer;

  &:hover { 
    transform: scale(1.05); 
  }
`;

const EditOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;

  ${AvatarWrapper}:hover & { 
    opacity: 1; 
  }
`;

const EditText = styled.span`
  color: white;
  font-size: 15px;
  font-weight: 600;
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const GenderButtons = styled.div`
  display: flex;
  gap: 12px;
  margin: 20px 0;
  justify-content: center;
`;

const GenderButton = styled.button`
  flex: 1;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 14px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  background: ${({ active }) => (active ? "#007aff" : "#f5f5f5")};
  color: ${({ active }) => (active ? "white" : "#333")};
  box-shadow: ${({ active }) => (active ? "0 4px 12px rgba(0, 122, 255, 0.25)" : "none")};

  &:hover { 
    background: ${({ active }) => (active ? "#0062d1" : "#e8e8e8")}; 
    transform: ${({ active }) => (active ? "translateY(-1px)" : "none")};
  }

  &:active {
    transform: translateY(0);
  }
`;

const InfoSection = styled.div`
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 16px;
  padding: 20px;
  margin: 24px 0;
`;

const InfoTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #856404;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const InfoText = styled.div`
  font-size: 14px;
  color: #856404;
  line-height: 1.6;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
  font-size: 15px;
  color: #333;
  cursor: pointer;
  user-select: none;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  border: 2px solid ${({ checked }) => (checked ? "#007aff" : "#e5e7eb")};
  transition: all 0.2s;

  &:hover {
    border-color: #007aff;
    background: #f0f9ff;
  }

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
`;

const CardSection = styled.div`
  margin: 24px 0;
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 16px;
  background: #fafafa;
`;

const CardBubbleContainer = styled.div`
  display: flex;
  gap: 7px;
  justify-content: center;
  margin-top: 16px;
  flex-wrap: nowrap;
`;

const CardBubble = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${({ filled }) => (filled ? "#007aff" : "#ccc")};
  animation: ${({ animate }) => (animate ? pop : "none")} 0.3s ease;
`;

const CardTypingCursor = styled.div`
  width: 2px;
  height: 16px;
  background: #007aff;
  animation: ${blink} 1s infinite;
  margin-left: 2px;
`;

const PaymentButtons = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
`;

const PaymentButton = styled.button`
  flex: 1;
  padding: 16px;
  font-size: 17px;
  font-weight: 600;
  border-radius: 14px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
  pointer-events: ${({ disabled }) => (disabled ? "none" : "auto")};

  ${({ variant }) =>
    variant === "card" &&
    `background: #007aff; 
     color: white; 
     box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);
     &:hover { 
       background: #0062d1; 
       transform: translateY(-2px);
       box-shadow: 0 6px 16px rgba(0, 122, 255, 0.35);
     }
     &:active {
       transform: translateY(0);
     }`}

  ${({ variant }) =>
    variant === "cashapp" &&
    `background: #00c244; 
     color: white; 
     box-shadow: 0 4px 12px rgba(0, 194, 68, 0.25);
     &:hover { 
       background: #00a83a; 
       transform: translateY(-2px);
       box-shadow: 0 6px 16px rgba(0, 194, 68, 0.35);
     }
     &:active {
       transform: translateY(0);
     }`}
`;

const Spinner = styled.div`
  width: 22px;
  height: 22px;
  border: 3px solid rgba(255, 255, 255, 0.4);
  border-top: 3px solid white;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const ErrorAlert = styled.div`
  background: #ffebee;
  color: #c62828;
  padding: 14px;
  border-radius: 14px;
  font-size: 14px;
  margin: 20px 0;
  text-align: center;
  animation: ${fadeIn} 0.3s ease;
  border: 1px solid #ef5350;
`;

const Spacer = styled.div`
  height: 40px;
`;

/* ---------------- COMPONENT ---------------- */
export default function RepostFinalPayment({ data, uid, onPay, onClose }) {
  const [photo, setPhoto] = useState("/phone.gif");
  const [gender, setGender] = useState(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [error, setError] = useState("");

  const [isCardValid, setIsCardValid] = useState(false);
  const [isCardProcessing, setIsCardProcessing] = useState(false);
  const [isCashAppProcessing, setIsCashAppProcessing] = useState(false);

  const [cardDigits, setCardDigits] = useState(0);
  const [animateCardIndex, setAnimateCardIndex] = useState(null);

  const storage = getStorage();
  const db = getFirestore();
  const stripe = useStripe();
  const elements = useElements();

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  /* ---------------- UPLOAD PHOTO ---------------- */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);

    try {
      const storageRef = ref(storage, `user_photos/${uid}/profile.jpg`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise((resolve, reject) => {
        uploadTask.on("state_changed", null, reject, resolve);
      });

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

      await updateDoc(doc(db, "Accounts", uid), {
        photo: downloadURL,
        updatedAt: new Date(),
      });

      setPhoto(downloadURL);
    } catch (err) {
      console.error(err);
      setError("Failed to upload photo");
    }
  };

  /* ---------------- CARD PAYMENT ---------------- */
  const handleCardChange = (e) => {
    setIsCardValid(e.complete);
    const rawValue = e?.value?.replace(/\D/g, "") || "";
    if (rawValue.length > cardDigits) setAnimateCardIndex(rawValue.length - 1);
    setCardDigits(rawValue.length);
  };

  const handleCardPay = async () => {
    if (!gender) return setError("Please select your gender");
    if (!rulesAccepted) return setError("You must accept the post rules");

    setError("");
    setIsCardProcessing(true);

    try {
      const res = await fetch(
        "https://repostnumber-li6hx2r5xq-uc.a.run.app",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, data, gender }),
        }
      );

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Payment failed");
      }

      onPay();
    } catch (err) {
      setError(err.message || "Card payment failed");
    } finally {
      setIsCardProcessing(false);
    }
  };

  /* ---------------- CASH APP PAYMENT ---------------- */
  const handleCashAppPay = async () => {
    if (!gender) return setError("Please select your gender");
    if (!rulesAccepted) return setError("You must accept the post rules");

    setError("");
    setIsCashAppProcessing(true);

    try {
      const res = await fetch(
        "https://repostnumbercashapp-li6hx2r5xq-uc.a.run.app",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, gender, data }),
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create payment");
      }

      const { clientSecret } = await res.json();
      if (!clientSecret) throw new Error("No client secret returned");

      await stripe.confirmCashappPayment(clientSecret, {
        payment_method: { type: "cashapp" },
        return_url: "https://calltelo.com/cashapp/repost-success",
      });

      onPay();
    } catch (err) {
      setError(err.message || "Cash App payment failed");
    } finally {
      setIsCashAppProcessing(false);
    }
  };

  /* ---------------- CLOSE HANDLER ---------------- */
  const handleClose = () => {
    setIsCardProcessing(false);
    setIsCashAppProcessing(false);
    setError("");
    onClose();
  };

  return (
    <ModalOverlay>
      <ModalCard>
        <CloseButton onClick={handleClose}>×</CloseButton>

        <ContentWrapper>
          <TitleWrapper>
            <IconRepeat size={26} color="#007aff" />
            <Title>Repost Your Number</Title>
          </TitleWrapper>
          <Subtitle>Keep your post active for another 24 hours</Subtitle>

          <AvatarWrapper>
            <Avatar 
              src={photo} 
              alt="Profile preview" 
              onClick={() => document.getElementById("fileInput")?.click()} 
            />
            <EditOverlay onClick={() => document.getElementById("fileInput")?.click()}>
              <EditText>Change</EditText>
            </EditOverlay>
            <HiddenFileInput 
              id="fileInput" 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </AvatarWrapper>

          <GenderButtons>
            <GenderButton 
              active={gender === "Male"} 
              onClick={() => setGender("Male")}
            >
              Male
            </GenderButton>
            <GenderButton 
              active={gender === "Woman"} 
              onClick={() => setGender("Woman")}
            >
              Woman
            </GenderButton>
          </GenderButtons>

          <InfoSection>
            <InfoTitle>
              <IconRepeat size={18} />
              Repost Benefits
            </InfoTitle>
            <InfoText>
              • Your post stays at the top of the feed<br/>
              • Fresh 24-hour visibility<br/>
              • Keep earning from new callers
            </InfoText>
          </InfoSection>

          <CheckboxLabel checked={rulesAccepted}>
            <input 
              type="checkbox" 
              checked={rulesAccepted} 
              onChange={(e) => setRulesAccepted(e.target.checked)} 
            />
            I agree to the post rules
          </CheckboxLabel>

          {error && <ErrorAlert>{error}</ErrorAlert>}

          <CardSection>
            <CardElement
              onChange={handleCardChange}
              options={{
                style: {
                  base: {
                    fontSize: "16px",
                    color: "#32325d",
                    "::placeholder": { color: "#aab7c4" },
                  },
                },
              }}
            />

            <CardBubbleContainer>
              {Array.from({ length: 16 }).map((_, i) => (
                <CardBubble 
                  key={i} 
                  filled={i < cardDigits} 
                  animate={i === animateCardIndex} 
                />
              ))}
              <CardTypingCursor />
            </CardBubbleContainer>
          </CardSection>

          <PaymentButtons>
            <PaymentButton 
              variant="card" 
              onClick={handleCardPay} 
              disabled={!isCardValid || isCardProcessing}
            >
              {isCardProcessing ? (
                <Spinner />
              ) : (
                <>
                  <CreditCard size={20} />
                  Card
                </>
              )}
            </PaymentButton>

            <PaymentButton 
              variant="cashapp" 
              onClick={handleCashAppPay} 
              disabled={isCashAppProcessing}
            >
              {isCashAppProcessing ? (
                <Spinner />
              ) : (
                <>
                  <DollarSign size={20} />
                  Cash App
                </>
              )}
            </PaymentButton>
          </PaymentButtons>

          <Spacer />
        </ContentWrapper>
      </ModalCard>
    </ModalOverlay>
  );
}