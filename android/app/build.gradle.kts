plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "io.github.bridgemouse.bacta"
    compileSdk {
        version = release(37) {
            minorApiLevel = 0
        }
    }

    defaultConfig {
        applicationId = "io.github.bridgemouse.bacta"
        minSdk = 34
        targetSdk = 37
        versionCode = (project.findProperty("bacta.versionCode") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("bacta.versionName") as String?) ?: "0.0.1"
    }

    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("BACTA_KEYSTORE_PATH")
            if (keystorePath != null) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("BACTA_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("BACTA_KEY_ALIAS")
                keyPassword = System.getenv("BACTA_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            if (System.getenv("BACTA_KEYSTORE_PATH") != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.foundation)

    testImplementation(libs.junit)
}
