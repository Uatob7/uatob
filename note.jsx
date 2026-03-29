import React, { useState, useEffect } from "react";
import { useAuthContext } from "@/context/AuthContext";
import ReactDOMServer from 'react-dom/server';
import { collection, doc, onSnapshot, getFirestore, updateDoc, getDocs,query,where } from "firebase/firestore";
import { firebase_app } from '@/firebase/config';
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useRouter } from 'next/router';
import styled from 'styled-components';



const db = getFirestore(firebase_app);
