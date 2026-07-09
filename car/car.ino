#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128 // Lebar OLED dalam piksel
#define SCREEN_HEIGHT 64 // Tinggi OLED dalam piksel
#define OLED_RESET     -1 // Pin reset (share dengan reset Arduino)
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Definisi Pin Sensor
const int pinAnalog = A0;
const int pinDigital = 2; // D2

// Pin Pompa Peristaltik
const int peris_IN1 = 8;
const int peris_IN2 = 7;
const int peris_STBY = 10;
const int peris_PWM = 5;

// Variabel Pewaktuan & Status
unsigned long previousMillis = 0;
const long interval = 250; // 0.25 detik (250 milidetik)
bool isRunning = false;     // Status apakah perekaman sudah dimulai

int nilaiAnalog = 0;
int nilaiDigital = 0;

void setup() {
  // Inisialisasi Serial Baud Rate disamakan dengan Python (115200)
  Serial.begin(115200);
  
  // Konfigurasi Pin Mode
  pinMode(pinAnalog, INPUT);
  pinMode(pinDigital, INPUT_PULLUP);
  pinMode(peris_IN1, OUTPUT); pinMode(peris_IN2, OUTPUT);
  pinMode(peris_STBY, OUTPUT); pinMode(peris_PWM, OUTPUT);

  // Inisialisasi OLED (Alamat default umumnya 0x3C)
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    for(;;); // Jika gagal, kunci di loop terus-menerus
  }
  
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  
  // Tampilan Awal sebelum start
  display.setTextSize(1);
  display.setCursor(15, 10);
  display.println("SISTEM TURBIDITAS");
  display.setCursor(25, 30);
  display.print("Status: STANDBY");
  display.setCursor(10, 48);
  display.print("Menunggu Python...");
  display.display();
}

void loop() {
  // Memeriksa perintah masuk dari Python
  if (Serial.available() > 0) {
    char command = Serial.read();
    if (command == 'S') {       
      isRunning = true;
      previousMillis = millis(); 
    } else if (command == 'E') { 
      isRunning = false;
      tampilkanStandbyOLED();
      hentikanSistem();
    }
  }

  if (isRunning) {
    unsigned long currentMillis = millis();
    
    // Membaca nilai analog
    nilaiAnalog = analogRead(pinAnalog);
    
    // Menghitung voltase untuk ditampilkan di OLED
    float voltase = (nilaiAnalog * 5.0) / 1023.0;
    jalankanSistem();
    
    // Update Tampilan OLED
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print("STATUS: LOGGING...");
    
    display.setTextSize(2);
    display.setCursor(0, 18);
    display.print("ADC : "); display.println(nilaiAnalog);
    display.setCursor(0, 42);
    display.print("V   : "); display.print(voltase, 2); display.println(" V"); // Menampilkan 2 angka di belakang koma
    display.display();

    // Mengirim data ke serial TEPAT setiap 0.25 detik
    if (currentMillis - previousMillis >= interval) {
      previousMillis = currentMillis;
      
      // Kirim Nilai Analog dan Nilai Digital (D2) dipisah koma ke Python
      // Python yang akan melakukan kalkulasi voltase presisi tinggi
      nilaiDigital = digitalRead(pinDigital);
      Serial.print(nilaiAnalog);
      Serial.print(",");
      Serial.println(nilaiDigital); 
    }
  }
}

void jalankanSistem() {
  isRunning = true;

  // Peristaltik ON
  digitalWrite(peris_STBY, HIGH);
  digitalWrite(peris_IN1, HIGH);
  digitalWrite(peris_IN2, LOW);
  analogWrite(peris_PWM, 100);
}

void hentikanSistem() {
  isRunning = false;
  digitalWrite(peris_STBY, LOW);
  digitalWrite(peris_IN1, LOW);
  digitalWrite(peris_IN2, LOW);
  analogWrite(peris_PWM, 0);
  delay(1000);
}

void tampilkanStandbyOLED() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(15, 10);
  display.println("SISTEM TURBIDITAS");
  display.setCursor(25, 30);
  display.print("Status: STOPPED");
  display.setCursor(10, 48);
  display.print("Membuka Log Baru..");
  display.display();
}